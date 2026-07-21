import { Errors } from '@oclif/core';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import type { StorageMode } from '../config/index.js';
import { loadSummaryLevel } from '../config/index.js';
import { buildCompressed } from './compress.js';
import { durationFlagError, resolveFreshnessPolicy } from './freshness.js';
import { applyAutoTags } from './keywords.js';
import { metadataNewlineError } from './metadata-flags.js';
import { persistArtifact } from './persist-artifact.js';
import { sanitizePromptInjection } from './prompt-injection.js';
import type { ResearchArtifact, ResearchArtifactMetadata } from './schema.js';
import { getArtifactPath } from './storage.js';
import { loadStoreRoots, type StoreRoots } from './store-roots.js';
import { estimateTokens } from './token-estimate.js';
import { deriveCacheKey } from './cache-key.js';
import { normalizeUrl } from './url.js';
import { failInvalidUrl, type CliIo } from './cli-io.js';
import { formatHumanFields } from '../cli-presentation.js';
import { sanitizeForTerminal } from '../text.js';

const INPUT_LIMIT_BYTES = 1024 * 1024;
// ponytail: 1s stdin idle timeout is enough for piped agent input; raise if interactive paste
// workflows need longer before the read aborts.
const STDIN_TIMEOUT_MS = 1000;

/** Minimal file-stat shape used by import input hooks. */
export interface ImportCommandFileStat {
  isFile(): boolean;
  size: number;
}

/** Injected IO hooks so import stays testable without a live TTY. */
export interface ImportCommandInputHooks {
  stdinIsInteractive(): boolean;
  readStdin(limitBytes: number): Promise<string>;
  fsExistsSync(filePath: string): boolean;
  fsStatSync(filePath: string): ImportCommandFileStat;
  fsReadFileSync(filePath: string): string;
}

/** Parsed flags for one import command invocation. */
export interface ImportCommandFlags {
  stdin: boolean;
  file?: string;
  inputFormat: 'compressed' | 'detailed';
  topic?: string;
  tags?: string[];
  tier: 'stable' | 'standard' | 'volatile';
  sourceUrls: string[];
  ttl?: string;
  storage?: StorageMode;
}

/** Positional args for one import command invocation. */
export interface ImportCommandArgs {
  url?: string;
}

/** Validated import inputs ready for persistence. */
export interface PreparedImportCommand {
  args: ImportCommandArgs;
  artifact: ResearchArtifact;
  cacheKey: string;
  flags: ImportCommandFlags;
  hasSingle: boolean;
  roots: StoreRoots;
  singleNormalizedUrl: string;
  sourceUrls: string[];
}

/**
 * Validate the request, read and validate the input content, and build the artifact — everything
 * up to (but excluding) the cache write, so the command can resolve dry-run mode in between.
 */
export async function prepareImportCommandService(opts: {
  args: ImportCommandArgs;
  flags: ImportCommandFlags;
  io: CliIo;
  input: ImportCommandInputHooks;
}): Promise<PreparedImportCommand> {
  const { args, flags, input, io } = opts;
  const hasSingle = Boolean(args.url);
  const hasMulti = flags.sourceUrls.length > 0;

  const ttlErr = durationFlagError('--ttl', flags.ttl);
  if (ttlErr) io.error(ttlErr, { exit: 2, code: 'INVALID_DURATION' });
  const metadataErr = metadataNewlineError(flags);
  if (metadataErr) {
    io.error(metadataErr, {
      exit: 2,
      code: 'INVALID_METADATA_VALUE',
      suggestions: ['Remove line breaks from the value.'],
    });
  }
  validateSourceMode(hasSingle, hasMulti, flags, io);
  const rawInput = await readAndValidateInput(flags, input, io);

  const sourceUrls = getSourceUrls(hasMulti, flags.sourceUrls, args.url, io);
  const singleNormalizedUrl = hasSingle ? sourceUrls[0] || '' : '';
  const cacheKey = deriveImportCacheKey(hasSingle, singleNormalizedUrl, sourceUrls, flags);

  const artifact = buildImportArtifact({
    hasSingle,
    singleUrl: args.url,
    singleNormalizedUrl,
    sourceUrls,
    cacheKey,
    rawInput,
    flags,
    io,
  });

  const roots = loadStoreRoots({
    configDir: io.configDir,
    cwd: io.cwd,
    dataDir: io.dataDir,
    flagOverride: flags.storage,
  });

  return {
    args,
    artifact,
    cacheKey,
    flags,
    hasSingle,
    roots,
    singleNormalizedUrl,
    sourceUrls,
  };
}

/** Persist (or dry-run preview) a prepared import and return the command's `--json` data payload. */
export function finishImportCommandService(
  prepared: PreparedImportCommand,
  dryRun: boolean,
  io: CliIo
): unknown {
  const { args, artifact, cacheKey, flags, hasSingle, roots, singleNormalizedUrl, sourceUrls } =
    prepared;
  const writeResult = persistArtifact({
    roots,
    cacheKey,
    artifact,
    dryRun,
    kind: 'import',
  });
  const storagePath = getArtifactPath(writeResult.dataDir, cacheKey);

  if (writeResult.redirectWarning) {
    io.warn(writeResult.redirectWarning);
  }

  if (!io.json) {
    logImportHumanSuccess(io, {
      dryRun,
      cacheKey,
      storagePath,
      hasSingle,
      flags,
      sourceUrls,
    });
  }

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
      // Multi-source notes have no single primary URL -- expose null plus sourceUrls above.
      url: hasSingle ? args.url! : null,
      normalizedUrl: hasSingle ? singleNormalizedUrl : null,
      captureMethod: 'agent_supplied',
      extractionStatus: 'agent_supplied',
      extractionConfidence: 'high',
      qualityNotes: artifact.metadata.quality_notes,
      fetchedAt: null,
      validatedAt: artifact.metadata.validated_at,
      staleAfter: artifact.metadata.stale_after,
    },
    format: flags.inputFormat,
    tokenEstimate:
      flags.inputFormat === 'compressed'
        ? artifact.metadata.token_estimate.compressed
        : artifact.metadata.token_estimate.detailed,
    content: flags.inputFormat === 'compressed' ? artifact.compressed : artifact.detailed,
  };
}

function logImportHumanSuccess(
  io: CliIo,
  opts: {
    dryRun: boolean;
    cacheKey: string;
    storagePath: string;
    hasSingle: boolean;
    flags: ImportCommandFlags;
    sourceUrls: string[];
  }
): void {
  const { dryRun, cacheKey, storagePath, hasSingle, flags, sourceUrls } = opts;
  io.log(
    dryRun
      ? `[dry-run] Would import research artifact.`
      : `Successfully imported research artifact.`
  );
  const fields: Array<readonly [string, string]> = [
    ['Cache Key', cacheKey],
    ['Storage Path', storagePath],
  ];
  // The agent-supplied --topic is untrusted the same way fetched content is (it may be lifted
  // straight from a page an agent just read), so it gets the same terminal sanitization as
  // list/inspect/prune apply to a cached topic before printing it.
  let topic: string | undefined;
  if (!hasSingle) {
    topic = sanitizeForTerminal(resolvedTopic(flags)!);
    fields.push(['Topic', topic], ['Source URLs', sourceUrls.join(', ')]);
  }
  for (const line of formatHumanFields(fields)) io.log(line);
  if (topic) {
    io.log(`\nTip: find it again with ${io.bin} list --topic "${topic}"`);
  }
}

function importSourceSuggestions(bin: string): string[] {
  return [
    `Single-source import: ${bin} import https://example.com/docs --file notes.md`,
    `Multi-source import: ${bin} import --source-url https://example.com/a --topic "Topic" --file notes.md`,
  ];
}

function stdinImportSuggestions(bin: string): string[] {
  return [
    `Pipe Markdown content, e.g. cat notes.md | ${bin} import <url> --stdin`,
    `Or use the standard stdin placeholder: cat notes.md | ${bin} import <url> --file -`,
    `Or read from a file: ${bin} import <url> --file notes.md`,
  ];
}

function validateSourceMode(
  hasSingle: boolean,
  hasMulti: boolean,
  flags: ImportCommandFlags,
  io: CliIo
): void {
  if (hasSingle && hasMulti) {
    io.error('Cannot specify both positional <url> and --source-url flags.', {
      exit: 2,
      code: 'CONFLICTING_FLAGS',
      suggestions: [
        'Use the positional URL for single-source import, or use only --source-url for multi-source import.',
      ],
    });
  }
  if (!hasSingle && !hasMulti) {
    io.error(
      'Must specify either positional <url> (for single-source) or --source-url (for multi-source) import.',
      { exit: 2, code: 'MISSING_URL', suggestions: importSourceSuggestions(io.bin) }
    );
  }
  if (hasMulti && !resolvedTopic(flags)) {
    io.error('Multi-source import requires the --topic flag.', {
      exit: 2,
      code: 'MISSING_TOPIC',
      suggestions: [`Add a topic: ${io.bin} import --source-url <url> --topic "Topic"`],
    });
  }
  if (!flags.stdin && !flags.file) {
    io.error('Either --stdin or --file <path> must be specified to import content.', {
      exit: 2,
      code: 'MISSING_INPUT',
      suggestions: stdinImportSuggestions(io.bin),
    });
  }
  if (flags.stdin && flags.file) {
    io.error('Cannot specify both --stdin and --file. Choose one input source.', {
      exit: 2,
      code: 'CONFLICTING_FLAGS',
      suggestions: [
        'Pipe content with --stdin, or read a file with --file notes.md; do not pass both.',
      ],
    });
  }
}

async function readStdinWithGuard(input: ImportCommandInputHooks, io: CliIo): Promise<string> {
  if (input.stdinIsInteractive()) {
    io.error('No data piped to --stdin.', {
      exit: 2,
      code: 'MISSING_STDIN',
      suggestions: stdinImportSuggestions(io.bin),
    });
  }

  let rawInput = '';
  try {
    rawInput = await Promise.race([
      input.readStdin(INPUT_LIMIT_BYTES),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('STDIN_TIMEOUT')), STDIN_TIMEOUT_MS)
      ),
    ]);
  } catch (err) {
    if ((err as Error).message === 'STDIN_TIMEOUT') {
      io.error('No stdin data received. Pipe content or use --file.', {
        exit: 2,
        code: 'MISSING_STDIN',
        suggestions: stdinImportSuggestions(io.bin),
      });
    }
    if ((err as Error).message.includes('stdin size limit exceeded')) {
      io.error((err as Error).message, {
        exit: 1,
        code: 'STDIN_TOO_LARGE',
        suggestions: ['Reduce the input below 1 MiB, or split the note into smaller imports.'],
      });
    }
    // Genuine stream failure reading stdin -> I/O failure (exit 1).
    io.error((err as Error).message, {
      exit: 1,
      code: 'IO_ERROR',
      suggestions: ['Retry with --file notes.md if stdin is unreliable in this shell.'],
    });
  }
  return rawInput;
}

function readAndValidateFile(filePath: string, input: ImportCommandInputHooks, io: CliIo): string {
  if (!input.fsExistsSync(filePath)) {
    io.error(`File does not exist: ${filePath}`, {
      exit: 2,
      code: 'FILE_NOT_FOUND',
      suggestions: ['Check the path, or pipe content with --stdin.'],
    });
  }
  const stat = input.fsStatSync(filePath);
  if (!stat.isFile()) {
    io.error(`Path is not a file: ${filePath}`, {
      exit: 2,
      code: 'NOT_A_FILE',
      suggestions: ['Pass a Markdown file path, or pipe content with --stdin.'],
    });
  }
  if (stat.size > INPUT_LIMIT_BYTES) {
    io.error('File size limit exceeded (max 1 MiB).', {
      exit: 1,
      code: 'FILE_TOO_LARGE',
      suggestions: ['Reduce the file below 1 MiB, or split the note into smaller imports.'],
    });
  }
  const content = input.fsReadFileSync(filePath);
  if (!content.trim()) {
    io.error('Empty file content provided.', {
      exit: 2,
      code: 'EMPTY_INPUT',
      suggestions: ['Provide non-empty Markdown content.'],
    });
  }
  return content;
}

async function readAndValidateInput(
  flags: ImportCommandFlags,
  input: ImportCommandInputHooks,
  io: CliIo
): Promise<string> {
  const fileReadsStdin = flags.file === '-';

  if (flags.stdin || fileReadsStdin) {
    const rawInput = await readStdinWithGuard(input, io);
    if (!rawInput.trim()) {
      io.error('Empty stdin content provided.', {
        exit: 2,
        code: 'EMPTY_INPUT',
        suggestions: stdinImportSuggestions(io.bin),
      });
    }
    return rawInput;
  }

  // validateSourceMode already required --stdin or --file.
  const filePath = resolve(flags.file!);
  try {
    return readAndValidateFile(filePath, input, io);
  } catch (err) {
    // readAndValidateFile raises usage errors via io.error, which throw CLIErrors carrying their
    // own exit code and message -- preserve those. Only an unexpected read failure is wrapped.
    if (err instanceof Errors.CLIError) throw err;
    io.error(`Failed to read file: ${(err as Error).message}`, {
      exit: 1,
      code: 'IO_ERROR',
      suggestions: ['Check file permissions, or pipe content with --stdin.'],
    });
  }
}

/** Trimmed --topic, or null when absent/whitespace-only. */
function resolvedTopic(flags: ImportCommandFlags): string | null {
  const topic = flags.topic?.trim();
  return topic || null;
}

function getSourceUrls(
  hasMulti: boolean,
  multiUrls: string[],
  singleUrl: string | undefined,
  io: CliIo
): string[] {
  const urls = hasMulti ? multiUrls : singleUrl ? [singleUrl] : [];
  const normalized = urls.map((u) => {
    try {
      return normalizeUrl(u);
    } catch (err) {
      // Shared exit point: a forgotten scheme reports MISSING_URL_SCHEME like every other command,
      // while genuinely malformed input stays INVALID_URL.
      failInvalidUrl(io.error, u, (err as Error).message);
    }
  });
  // Deduplicate after normalization so repeated --source-url values do not inflate the key.
  return hasMulti ? [...new Set(normalized)].sort() : normalized;
}

function deriveImportCacheKey(
  hasSingle: boolean,
  singleNormalizedUrl: string,
  sourceUrls: string[],
  flags: ImportCommandFlags
): string {
  if (hasSingle) {
    return deriveCacheKey(singleNormalizedUrl);
  }
  const combinedString = [resolvedTopic(flags)!.toLowerCase(), ...sourceUrls].join('|');
  return createHash('sha256').update(combinedString).digest('hex');
}

function buildImportArtifact(opts: {
  hasSingle: boolean;
  singleUrl: string | undefined;
  singleNormalizedUrl: string;
  sourceUrls: string[];
  cacheKey: string;
  rawInput: string;
  flags: ImportCommandFlags;
  io: CliIo;
}): ResearchArtifact {
  const { hasSingle, singleUrl, singleNormalizedUrl, sourceUrls, cacheKey, rawInput, flags, io } =
    opts;
  const currentTime = new Date();
  const ttl = flags.ttl || null;
  const { freshWindowMs } = resolveFreshnessPolicy(flags.tier, ttl);
  const staleAfterTime = new Date(currentTime.getTime() + freshWindowMs);

  const detailed = sanitizePromptInjection(rawInput);
  // Always sanitize -- agent-supplied notes are untrusted regardless of density. When the caller
  // already provided compressed Markdown, keep that body; otherwise condense the detailed import.
  const compressed =
    flags.inputFormat === 'detailed'
      ? buildCompressed(detailed, loadSummaryLevel(io.configDir, io.cwd))
      : detailed;
  const contentHash = createHash('sha256').update(detailed).digest('hex');

  const metadata: ResearchArtifactMetadata = {
    schema_version: 1,
    artifact_type: hasSingle ? 'source' : 'research_note',
    source_url: hasSingle ? singleUrl! : '',
    source_urls: sourceUrls,
    normalized_url: singleNormalizedUrl,
    cache_key: cacheKey,
    topic: resolvedTopic(flags),
    tags: flags.tags || [],
    format_available: ['compressed', 'detailed'],
    tier: flags.tier,
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
    summary: `Synthesized research for ${hasSingle ? singleNormalizedUrl : resolvedTopic(flags)}`,
    compressed,
    detailed,
    provenance: `Imported via agent-supplied research at ${currentTime.toISOString()}`,
  });
}
