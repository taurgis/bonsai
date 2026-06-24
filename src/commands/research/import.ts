import { Args, Flags } from '@oclif/core';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BaseCommand } from '../../base-command.js';
import { normalizeUrl } from '../../lib/research/url.js';
import { deriveCacheKey } from '../../lib/research/cache-key.js';
import { writeArtifact, getArtifactPath } from '../../lib/research/storage.js';
import { getPolicy } from '../../lib/research/freshness.js';
import { compressMarkdown } from '../../lib/research/compress.js';
import { estimateTokens } from '../../lib/research/token-estimate.js';
import type { ResearchArtifact, ResearchArtifactMetadata } from '../../lib/research/schema.js';

export default class ResearchImport extends BaseCommand<typeof ResearchImport> {
  static id = 'research import';
  static summary = 'Import agent-supplied clean Markdown notes into the local cache.';
  static description =
    'Accepts a synthesized Markdown note via stdin and registers it under the single target URL or multiple source URLs.';

  static examples = [
    {
      description: 'Import detailed research for a single URL via stdin',
      command:
        'echo "# My Article" | <%= config.bin %> research import https://example.com/docs --stdin',
    },
    {
      description: 'Import research synthesized from multiple source URLs',
      command:
        'echo "# Synthesized" | <%= config.bin %> research import --stdin --topic "React docs" --source-url https://react.dev/a --source-url https://react.dev/b',
    },
    {
      description: 'Import research from a local Markdown file',
      command: '<%= config.bin %> research import https://example.com/docs --file path/to/notes.md',
    },
  ];

  static args = {
    url: Args.string({
      required: false,
      description: 'The single source URL of the page (only for single-source import).',
    }),
  };

  static flags = {
    stdin: Flags.boolean({
      description: 'Read Markdown from stdin.',
      default: false,
    }),
    file: Flags.string({
      description: 'Path to a Markdown file containing research notes to import.',
    }),
    'input-format': Flags.option({
      description: 'Format of the input provided.',
      options: ['compressed', 'detailed'] as const,
      default: 'detailed',
    })(),
    topic: Flags.string({
      char: 't',
      description: 'The main topic for this research note.',
    }),
    tags: Flags.string({
      char: 'g',
      description: 'Taxonomic tags (can be repeated).',
      multiple: true,
    }),
    tier: Flags.option({
      description: 'Freshness tier policy.',
      options: ['stable', 'standard', 'volatile'] as const,
      default: 'standard',
    })(),
    'source-url': Flags.string({
      description: 'Repeated source URLs for multi-source import.',
      multiple: true,
    }),
    ttl: Flags.string({
      char: 'l',
      description: 'Predicted lifespan of the data (e.g. "24h", "7d").',
    }),
  };

  static stdoutIsPrimaryData = true;

  async init(): Promise<void> {
    await super.init();
    const { args, flags } = await this.parse(ResearchImport);
    this.args = args;
    this.flags = flags;
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
        this.error(`Invalid URL: ${(err as Error).message}`, { exit: 2 });
      }
    }) as string[];
    return hasMulti ? normalized.sort() : normalized;
  }

  private validateSourceMode(hasSingle: boolean, hasMulti: boolean, multiUrls: string[]): void {
    if (hasSingle && hasMulti) {
      this.error('Cannot specify both positional <url> and --source-url flags.', { exit: 2 });
    }
    if (!hasSingle && !hasMulti) {
      this.error(
        'Must specify either positional <url> (for single-source) or --source-url (for multi-source) import.',
        { exit: 2 }
      );
    }
    if (hasMulti && !this.flags.topic) {
      this.error('Multi-source import requires the --topic flag.', { exit: 2 });
    }
    if (!this.flags.stdin && !this.flags.file) {
      this.error('Either --stdin or --file <path> must be specified to import content.', {
        exit: 2,
      });
    }
    if (this.flags.stdin && this.flags.file) {
      this.error('Cannot specify both --stdin and --file <path>. Choose one.', { exit: 2 });
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

  private readAndValidateFile(filePath: string): string {
    if (!this.fsExistsSync(filePath)) {
      this.error(`File does not exist: ${filePath}`, { exit: 2 });
    }
    const stat = this.fsStatSync(filePath);
    if (!stat.isFile()) {
      this.error(`Path is not a file: ${filePath}`, { exit: 2 });
    }
    if (stat.size > 1024 * 1024) {
      this.error('File size limit exceeded (max 1 MiB).', { exit: 1 });
    }
    const content = this.fsReadFileSync(filePath);
    if (!content.trim()) {
      this.error('Empty file content provided.', { exit: 2 });
    }
    return content;
  }

  private async readAndValidateInput(): Promise<string> {
    if (this.flags.stdin) {
      try {
        const rawInput = await this.readStdin();
        if (!rawInput.trim()) {
          this.error('Empty stdin content provided.', { exit: 2 });
        }
        return rawInput;
      } catch (err) {
        this.error((err as Error).message, { exit: 1 });
      }
    }

    if (this.flags.file) {
      const filePath = path.resolve(this.flags.file);
      try {
        return this.readAndValidateFile(filePath);
      } catch (err) {
        this.error(`Failed to read file: ${(err as Error).message}`, { exit: 1 });
      }
    }

    this.error('No input source specified.', { exit: 2 });
  }

  private deriveImportCacheKey(
    hasSingle: boolean,
    singleNormalizedUrl: string,
    sourceUrls: string[]
  ): string {
    if (hasSingle) {
      return deriveCacheKey(singleNormalizedUrl);
    }
    const normalizedTopic = this.flags.topic!.trim().toLowerCase();
    const combinedString = [normalizedTopic, ...sourceUrls].join('|');
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
    const detailed = rawInput;
    const compressed = inputFormat === 'detailed' ? compressMarkdown(rawInput) : rawInput;
    const contentHash = createHash('sha256').update(detailed).digest('hex');

    const metadata: ResearchArtifactMetadata = {
      schema_version: 1,
      artifact_type: hasSingle ? 'source' : 'research_note',
      source_url: hasSingle ? this.args.url! : '',
      source_urls: sourceUrls,
      normalized_url: singleNormalizedUrl,
      cache_key: cacheKey,
      topic: this.flags.topic || null,
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
    };

    return {
      metadata,
      summary: `Synthesized research for ${hasSingle ? singleNormalizedUrl : this.flags.topic}`,
      compressed,
      detailed,
      provenance: `Imported via agent-supplied research at ${currentTime.toISOString()}`,
    };
  }

  async execute(): Promise<unknown> {
    const hasSingle = Boolean(this.args.url);
    const multiUrls = this.flags['source-url'] || [];
    const hasMulti = multiUrls.length > 0;

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

    const dataDir = this.config.dataDir;
    writeArtifact(dataDir, cacheKey, artifact);

    if (!this.requestedJson()) {
      this.log(`Successfully imported research artifact.`);
      this.log(`Cache Key: ${cacheKey}`);
      this.log(`Storage Path: ${getArtifactPath(dataDir, cacheKey)}`);
    }

    const inputFormat = this.flags['input-format'];
    return {
      schemaVersion: 1,
      command: 'research import',
      cache: {
        key: cacheKey,
        status: 'imported',
        freshness: 'fresh',
        path: getArtifactPath(dataDir, cacheKey),
      },
      source: {
        url: hasSingle ? this.args.url! : '',
        normalizedUrl: singleNormalizedUrl,
        captureMethod: 'agent_supplied',
        extractionStatus: 'agent_supplied',
        extractionConfidence: 'high',
        qualityNotes: ['agent-supplied research import'],
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
