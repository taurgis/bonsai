import { Args, Errors, Flags } from '@oclif/core';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BaseCommand } from '../base-command.js';
import { normalizeUrl } from '../lib/research/url.js';
import { deriveCacheKey } from '../lib/research/cache-key.js';
import { getArtifactPath } from '../lib/research/storage.js';
import { loadStoreRoots } from '../lib/research/store-roots.js';
import { writeArtifactSecurely } from '../lib/research/secure-write.js';
import { loadSummaryLevel, type StorageMode } from '../lib/config/index.js';
import { durationFlagError, getPolicy } from '../lib/research/freshness.js';
import { buildCompressed } from '../lib/research/compress.js';
import { sanitizePromptInjection } from '../lib/research/prompt-injection.js';
import { applyAutoTags } from '../lib/research/keywords.js';
import { estimateTokens } from '../lib/research/token-estimate.js';
import type { ResearchArtifact, ResearchArtifactMetadata } from '../lib/research/schema.js';

export default class ResearchImport extends BaseCommand<typeof ResearchImport> {
  static id = 'import';
  static summary = 'Import agent-supplied clean Markdown notes into the local cache.';
  static description =
    'Accepts a synthesized Markdown note via stdin or --file and registers it under the single target URL or multiple source URLs.';

  static examples = [
    {
      description: 'import detailed research for a single URL via stdin',
      command: 'echo "# My Article" | <%= config.bin %> import https://example.com/docs --stdin',
    },
    {
      description: 'import research synthesized from multiple source URLs',
      command:
        'echo "# Synthesized" | <%= config.bin %> import --stdin --topic "React docs" --source-url https://react.dev/a --source-url https://react.dev/b',
    },
    {
      description: 'import research from a local Markdown file',
      command: '<%= config.bin %> import https://example.com/docs --file path/to/notes.md',
    },
    {
      description: 'import research from stdin using the standard file placeholder',
      command: 'cat notes.md | <%= config.bin %> import https://example.com/docs --file -',
    },
  ];

  static args = {
    url: Args.string({
      required: false,
      // oclif fills an omitted optional arg from piped stdin unless ignoreStdin is set. Without
      // this, the Markdown piped for `--stdin` is swallowed into `url`, making multi-source import
      // (`import --stdin --source-url ...`) wrongly look like it also got a positional URL.
      ignoreStdin: true,
      description: 'the single source URL of the page (only for single-source import)',
    }),
  };

  static flags = {
    stdin: Flags.boolean({
      description: 'read Markdown from stdin',
      default: false,
    }),
    file: Flags.string({
      char: 'f',
      description: 'path to a Markdown file containing research notes to import, or "-" for stdin',
    }),
    'input-format': Flags.option({
      description: 'format of the input provided',
      options: ['compressed', 'detailed'] as const,
      default: 'detailed',
    })(),
    topic: Flags.string({
      char: 't',
      description: 'the main topic for this research note',
    }),
    tags: Flags.string({
      char: 'g',
      description: 'taxonomic tags (can be repeated)',
      multiple: true,
    }),
    tier: Flags.option({
      description: 'freshness tier policy',
      options: ['stable', 'standard', 'volatile'] as const,
      default: 'standard',
    })(),
    'source-url': Flags.string({
      description: 'repeated source URLs for multi-source import',
      multiple: true,
    }),
    ttl: Flags.string({
      char: 'l',
      description: 'predicted lifespan of the data (e.g. "24h", "7d")',
    }),
    'dry-run': Flags.boolean({
      description: 'validate and preview the import without writing to cache',
      default: false,
    }),
    storage: Flags.option({
      description: 'override where this note is cached (secrets always stored globally)',
      options: ['global', 'project'] as const,
    })(),
  };

  static stdoutIsPrimaryData = true;

  private importSourceSuggestions(): string[] {
    const bin = this.config.bin;
    return [
      `Single-source import: ${bin} import https://example.com/docs --file notes.md`,
      `Multi-source import: ${bin} import --source-url https://example.com/a --topic "Topic" --file notes.md`,
    ];
  }

  // Isolated so tests can force the interactive branch; `isTTY` is `true` only on a real terminal and
  // falsy (undefined) for pipes, files, and /dev/null. See https://nodejs.org/api/process.html#processstdin
  protected stdinIsInteractive(): boolean {
    return process.stdin.isTTY === true;
  }

  private async readStdin(limitBytes: number = 1024 * 1024): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = '';
      let bytesRead = 0;
      process.stdin.setEncoding('utf8');

      const onData = (chunk: string) => {
        bytesRead += Buffer.byteLength(chunk, 'utf8');
        if (bytesRead > limitBytes) {
          process.stdin.removeListener('data', onData);
          reject(new Error('stdin size limit exceeded (max 1 MiB)'));
          return;
        }
        data += chunk;
      };

      process.stdin.on('data', onData);

      const onEnd = () => {
        process.stdin.removeListener('data', onData);
        resolve(data);
      };
      process.stdin.once('end', onEnd);

      process.stdin.once('error', (err) => {
        process.stdin.removeListener('data', onData);
        process.stdin.removeListener('end', onEnd);
        reject(err);
      });
    });
  }

  private getSourceUrls(
    hasMulti: boolean,
    multiUrls: string[],
    singleUrl: string | undefined
  ): string[] {
    const urls = hasMulti ? multiUrls : singleUrl ? [singleUrl] : [];
    const normalized = urls.map((u) => {
      try {
        return normalizeUrl(u);
      } catch (err) {
        // Shared exit point: a forgotten scheme reports MISSING_URL_SCHEME like every other command,
        // while genuinely malformed input stays INVALID_URL.
        this.failInvalidUrl(u, (err as Error).message);
      }
    }) as string[];
    // Deduplicate after normalization so repeated --source-url values do not inflate the key.
    return hasMulti ? [...new Set(normalized)].sort() : normalized;
  }

  private validateSourceMode(hasSingle: boolean, hasMulti: boolean, multiUrls: string[]): void {
    if (hasSingle && hasMulti) {
      this.error('Cannot specify both positional <url> and --source-url flags.', {
        exit: 2,
        code: 'CONFLICTING_FLAGS',
        suggestions: [
          'Use the positional URL for single-source import, or use only --source-url for multi-source import.',
        ],
      });
    }
    if (!hasSingle && !hasMulti) {
      this.error(
        'Must specify either positional <url> (for single-source) or --source-url (for multi-source) import.',
        { exit: 2, code: 'MISSING_URL', suggestions: this.importSourceSuggestions() }
      );
    }
    if (hasMulti && !this.resolvedTopic()) {
      this.error('Multi-source import requires the --topic flag.', {
        exit: 2,
        code: 'MISSING_TOPIC',
        suggestions: [`Add a topic: ${this.config.bin} import --source-url <url> --topic "Topic"`],
      });
    }
    if (!this.flags.stdin && !this.flags.file) {
      this.error('Either --stdin or --file <path> must be specified to import content.', {
        exit: 2,
        code: 'MISSING_INPUT',
        suggestions: this.stdinImportSuggestions(),
      });
    }
    if (this.flags.stdin && this.flags.file) {
      this.error('Cannot specify both --stdin and --file. Choose one input source.', {
        exit: 2,
        code: 'CONFLICTING_FLAGS',
        suggestions: [
          'Pipe content with --stdin, or read a file with --file notes.md; do not pass both.',
        ],
      });
    }
  }

  protected fsExistsSync(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  protected fsStatSync(filePath: string): fs.Stats {
    return fs.statSync(filePath);
  }

  protected fsReadFileSync(filePath: string): string {
    return fs.readFileSync(filePath, 'utf8');
  }

  private stdinImportSuggestions(): string[] {
    const bin = this.config.bin;
    return [
      `Pipe Markdown content, e.g. cat notes.md | ${bin} import <url> --stdin`,
      `Or use the standard stdin placeholder: cat notes.md | ${bin} import <url> --file -`,
      `Or read from a file: ${bin} import <url> --file notes.md`,
    ];
  }

  /** Non-interactive stdin that never receives data (open pipe with no writer) must not hang forever. */
  private async readStdinWithGuard(limitBytes: number = 1024 * 1024): Promise<string> {
    if (this.stdinIsInteractive()) {
      this.error('No data piped to --stdin.', {
        exit: 2,
        code: 'MISSING_STDIN',
        suggestions: this.stdinImportSuggestions(),
      });
    }

    const timeoutMs = 1000;
    let rawInput = '';
    try {
      rawInput = await Promise.race([
        this.readStdin(limitBytes),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('STDIN_TIMEOUT')), timeoutMs)
        ),
      ]);
    } catch (err) {
      if ((err as Error).message === 'STDIN_TIMEOUT') {
        this.error('No stdin data received. Pipe content or use --file.', {
          exit: 2,
          code: 'MISSING_STDIN',
          suggestions: this.stdinImportSuggestions(),
        });
      }
      if ((err as Error).message.includes('stdin size limit exceeded')) {
        this.error((err as Error).message, {
          exit: 1,
          code: 'STDIN_TOO_LARGE',
          suggestions: ['Reduce the input below 1 MiB, or split the note into smaller imports.'],
        });
      }
      // Genuine stream failure reading stdin → I/O failure (exit 1).
      this.error((err as Error).message, {
        exit: 1,
        code: 'IO_ERROR',
        suggestions: ['Retry with --file notes.md if stdin is unreliable in this shell.'],
      });
    }
    return rawInput;
  }

  private readAndValidateFile(filePath: string): string {
    if (!this.fsExistsSync(filePath)) {
      this.error(`File does not exist: ${filePath}`, {
        exit: 2,
        code: 'FILE_NOT_FOUND',
        suggestions: ['Check the path, or pipe content with --stdin.'],
      });
    }
    const stat = this.fsStatSync(filePath);
    if (!stat.isFile()) {
      this.error(`Path is not a file: ${filePath}`, {
        exit: 2,
        code: 'NOT_A_FILE',
        suggestions: ['Pass a Markdown file path, or pipe content with --stdin.'],
      });
    }
    if (stat.size > 1024 * 1024) {
      this.error('File size limit exceeded (max 1 MiB).', {
        exit: 1,
        code: 'FILE_TOO_LARGE',
        suggestions: ['Reduce the file below 1 MiB, or split the note into smaller imports.'],
      });
    }
    const content = this.fsReadFileSync(filePath);
    if (!content.trim()) {
      this.error('Empty file content provided.', {
        exit: 2,
        code: 'EMPTY_INPUT',
        suggestions: ['Provide non-empty Markdown content.'],
      });
    }
    return content;
  }

  private async readAndValidateInput(): Promise<string> {
    const fileReadsStdin = this.flags.file === '-';

    if (this.flags.stdin || fileReadsStdin) {
      const rawInput = await this.readStdinWithGuard();
      if (!rawInput.trim()) {
        this.error('Empty stdin content provided.', {
          exit: 2,
          code: 'EMPTY_INPUT',
          suggestions: this.stdinImportSuggestions(),
        });
      }
      return rawInput;
    }

    if (this.flags.file) {
      const filePath = path.resolve(this.flags.file);
      try {
        return this.readAndValidateFile(filePath);
      } catch (err) {
        // readAndValidateFile raises usage errors (missing/not-a-file/empty) via this.error,
        // which throw CLIErrors carrying their own exit code and message — preserve those.
        // Only an unexpected read failure becomes a wrapped I/O failure (exit 1).
        if (err instanceof Errors.CLIError) throw err;
        this.error(`Failed to read file: ${(err as Error).message}`, {
          exit: 1,
          code: 'IO_ERROR',
          suggestions: ['Check file permissions, or pipe content with --stdin.'],
        });
      }
    }

    this.error('No input source specified.', {
      exit: 2,
      code: 'MISSING_INPUT',
      suggestions: this.stdinImportSuggestions(),
    });
  }

  /** Trimmed --topic, or null when absent/whitespace-only. */
  private resolvedTopic(): string | null {
    const topic = this.flags.topic?.trim();
    return topic || null;
  }

  private deriveImportCacheKey(
    hasSingle: boolean,
    singleNormalizedUrl: string,
    sourceUrls: string[]
  ): string {
    if (hasSingle) {
      return deriveCacheKey(singleNormalizedUrl);
    }
    const combinedString = [this.resolvedTopic()!.toLowerCase(), ...sourceUrls].join('|');
    return createHash('sha256').update(combinedString).digest('hex');
  }

  private buildImportArtifact(
    hasSingle: boolean,
    singleNormalizedUrl: string,
    sourceUrls: string[],
    cacheKey: string,
    rawInput: string
  ): ResearchArtifact {
    const currentTime = new Date();
    const tier = this.flags.tier;
    const ttl = this.flags.ttl || null;
    const { freshWindowMs } = getPolicy(tier, ttl);
    const staleAfterTime = new Date(currentTime.getTime() + freshWindowMs);

    const inputFormat = this.flags['input-format'];
    const detailed = sanitizePromptInjection(rawInput);
    // Always sanitize — agent-supplied notes are untrusted regardless of density. When the caller
    // already provided compressed Markdown, keep that (sanitized) body as the compressed form;
    // otherwise condense the detailed import with the same policy as fetch.
    const compressed =
      inputFormat === 'detailed'
        ? buildCompressed(detailed, loadSummaryLevel(this.config.configDir, process.cwd()))
        : detailed;
    const contentHash = createHash('sha256').update(detailed).digest('hex');

    const metadata: ResearchArtifactMetadata = {
      schema_version: 1,
      artifact_type: hasSingle ? 'source' : 'research_note',
      source_url: hasSingle ? this.args.url! : '',
      source_urls: sourceUrls,
      normalized_url: singleNormalizedUrl,
      cache_key: cacheKey,
      topic: this.resolvedTopic(),
      tags: this.flags.tags || [],
      format_available: ['compressed', 'detailed'],
      tier,
      ttl,
      fetched_at: null,
      validated_at: currentTime.toISOString(),
      stale_after: staleAfterTime.toISOString(),
      capture_method: 'agent_supplied',
      extraction_status: 'agent_supplied',
      extraction_confidence: 'high',
      quality_notes: ['agent-supplied research import'],
      supplied_at: currentTime.toISOString(),
      supplied_by: null,
      etag: null,
      last_modified: null,
      content_hash: contentHash,
      token_estimate: {
        compressed: estimateTokens(compressed),
        detailed: estimateTokens(detailed),
      },
      status: 'active',
      site_module_id: null,
      docs_engine: null,
      docs_framework: null,
      source_doc_url: null,
      search_provider: null,
      parent_cache_key: null,
      section_anchor: null,
      section_heading_path: null,
    };

    // Auto-tag from the content when the caller supplied none, so imported notes stay searchable by
    // keyword without forcing manual tagging. Explicit --tags always win (handled in applyAutoTags).
    return applyAutoTags({
      metadata,
      summary: `Synthesized research for ${hasSingle ? singleNormalizedUrl : this.resolvedTopic()}`,
      compressed,
      detailed,
      provenance: `Imported via agent-supplied research at ${currentTime.toISOString()}`,
    });
  }

  async run(): Promise<unknown> {
    const hasSingle = Boolean(this.args.url);
    const multiUrls = this.flags['source-url'] || [];
    const hasMulti = multiUrls.length > 0;

    const ttlErr = durationFlagError('--ttl', this.flags.ttl);
    if (ttlErr) this.error(ttlErr, { exit: 2, code: 'INVALID_DURATION' });

    this.validateSourceMode(hasSingle, hasMulti, multiUrls);
    const rawInput = await this.readAndValidateInput();

    const sourceUrls = this.getSourceUrls(hasMulti, multiUrls, this.args.url);
    const singleNormalizedUrl = hasSingle ? sourceUrls[0] || '' : '';
    const cacheKey = this.deriveImportCacheKey(hasSingle, singleNormalizedUrl, sourceUrls);

    const artifact = this.buildImportArtifact(
      hasSingle,
      singleNormalizedUrl,
      sourceUrls,
      cacheKey,
      rawInput
    );

    const roots = loadStoreRoots({
      configDir: this.config.configDir,
      cwd: process.cwd(),
      dataDir: this.config.dataDir,
      flagOverride: this.flags.storage as StorageMode | undefined,
    });

    const dryRun = this.effectiveDryRun(this.flags['dry-run']);
    const writeResult = writeArtifactSecurely(roots, cacheKey, artifact, { dryRun });
    const storagePath = getArtifactPath(writeResult.dataDir, cacheKey);

    if (writeResult.redirected) {
      this.warn(
        `Detected ${writeResult.secretLabel} in the imported content; stored in the global cache instead of the project to avoid committing secrets.`
      );
    }

    if (!this.jsonEnabled()) {
      this.log(
        dryRun
          ? `[dry-run] Would import research artifact.`
          : `Successfully imported research artifact.`
      );
      this.log(`${'Cache Key:'.padEnd(25)} ${cacheKey}`);
      this.log(`${'Storage Path:'.padEnd(25)} ${storagePath}`);
      if (!hasSingle) {
        const topic = this.resolvedTopic()!;
        this.log(`${'Topic:'.padEnd(25)} ${topic}`);
        this.log(`${'Source URLs:'.padEnd(25)} ${sourceUrls.join(', ')}`);
        this.log(`\nTip: find it again with ${this.config.bin} list --topic "${topic}"`);
      }
    }

    const inputFormat = this.flags['input-format'];
    return {
      schemaVersion: 1,
      command: 'import',
      dryRun,
      cache: {
        key: cacheKey,
        status: dryRun ? 'would_import' : 'imported',
        freshness: 'fresh',
        path: storagePath,
        storage: roots.mode,
        redirectedToGlobal: writeResult.redirected,
      },
      artifactType: artifact.metadata.artifact_type,
      topic: artifact.metadata.topic,
      sourceUrls,
      source: {
        // Multi-source notes have no single primary URL — expose null plus sourceUrls above.
        url: hasSingle ? this.args.url! : null,
        normalizedUrl: hasSingle ? singleNormalizedUrl : null,
        captureMethod: 'agent_supplied',
        extractionStatus: 'agent_supplied',
        extractionConfidence: 'high',
        qualityNotes: artifact.metadata.quality_notes,
        fetchedAt: null,
        validatedAt: artifact.metadata.validated_at,
        staleAfter: artifact.metadata.stale_after,
      },
      format: inputFormat,
      tokenEstimate:
        inputFormat === 'compressed'
          ? artifact.metadata.token_estimate.compressed
          : artifact.metadata.token_estimate.detailed,
      content: inputFormat === 'compressed' ? artifact.compressed : artifact.detailed,
    };
  }
}
