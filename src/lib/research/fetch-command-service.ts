import { Errors } from '@oclif/core';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { finalizeBatch } from '../batch.js';
import { formatErrorForJson } from '../envelope.js';
import type { StorageMode, SummaryLevel } from '../config/index.js';
import { loadSummaryLevel } from '../config/index.js';
import {
  buildFetchFailureFromCaught,
  buildFetchFailureResult,
  buildFetchResultData,
  describeError,
  extractionQualityWarnings,
  FETCH_STATUS_LABEL,
  fetchFailureGuidance,
  reportCacheStatus,
} from './fetch-result.js';
import { durationFlagError, evaluateFreshnessWithMaxAge } from './freshness.js';
import { metadataLengthError, metadataNewlineError } from './metadata-flags.js';
import { fetchRenderedHtml } from './browser.js';
import { capturePage, type CaptureDeps, type CaptureOutcome } from './capture.js';
import { persistSectionArtifacts } from './docs/section-artifacts.js';
import { fetchStaticHtml, fetchText } from './fetcher.js';
import { applyAutoTags } from './keywords.js';
import { persistArtifact } from './persist-artifact.js';
import {
  createArtifactFromFetch,
  revalidateCache,
  type RevalidateSecureWrite,
} from './revalidate.js';
import { resolveResearchTarget, type ResolvedResearchTarget } from './resolve-target.js';
import { locateArtifact } from './storage.js';
import type { ResearchArtifact } from './schema.js';
import { failInvalidUrl, type CliIo } from './cli-io.js';
import { batchSeparator } from '../cache-view.js';
import type { CacheHitStatus, FreshnessState } from '../cli-result-types.js';
import { EXIT_STALE_SERVED } from '../cli-error-policy.js';
import { detectSite } from '../../sites/index.js';
import { applySiteFetchProvenance, type SiteFetchResult } from '../../sites/types.js';

const CAPTURE_DEPS: CaptureDeps = {
  fetchStatic: fetchStaticHtml,
  fetchRendered: fetchRenderedHtml,
  fetchText,
};

/** Cache status, freshness, and artifact resolved for one URL. */
interface ResolvedFetchArtifact {
  cacheStatus: CacheHitStatus;
  freshnessState: FreshnessState;
  artifact: ResearchArtifact;
}

/** Spinner port used while a fetch is in progress. */
export interface FetchCommandSpinner {
  running(): boolean;
  start(msg: string): void;
  stop(msg?: string): void;
}

/** Parsed flags for one fetch command invocation. */
export interface FetchCommandFlags {
  topic?: string;
  tags?: string[];
  format: 'compressed' | 'detailed';
  tier: 'stable' | 'standard' | 'volatile';
  ttl?: string;
  maxAge?: string;
  force: boolean;
  allowStale: boolean;
  rendered: boolean;
  storage?: StorageMode;
}

/** Inputs for {@link runFetchCommandService}. */
export interface FetchCommandServiceOptions {
  urls: string[];
  flags: FetchCommandFlags;
  dryRun: boolean;
  io: CliIo;
  spinner: FetchCommandSpinner;
}

/**
 * Constants for one command invocation, threaded through every per-URL helper.
 * `tmpDir` is the dry-run throwaway write dir (null outside dry-run).
 */
interface FetchRun {
  flags: FetchCommandFlags;
  io: CliIo;
  spinner: FetchCommandSpinner;
  currentTime: Date;
  tmpDir: string | null;
  summaryLevel: SummaryLevel;
  dryRun: boolean;
  urlCount: number;
}

/** Reject invalid duration values and contradictory flag pairs before any URL work starts. */
export function validateFetchCommandFlags(io: CliIo, flags: FetchCommandFlags): void {
  for (const msg of [
    durationFlagError('--ttl', flags.ttl),
    durationFlagError('--max-age', flags.maxAge),
  ]) {
    if (msg) io.error(msg, { exit: 2, code: 'INVALID_DURATION' });
  }
  const newlineErr = metadataNewlineError(flags);
  if (newlineErr) {
    io.error(newlineErr, {
      exit: 2,
      code: 'INVALID_METADATA_VALUE',
      suggestions: ['Remove line breaks from the value.'],
    });
  }
  const lengthErr = metadataLengthError(flags);
  if (lengthErr) {
    io.error(lengthErr, {
      exit: 2,
      code: 'INVALID_METADATA_VALUE',
      suggestions: ['Shorten the value.'],
    });
  }
  // --force skips cache lookup; --allow-stale only applies when serving a stale entry after a
  // failed revalidation. Together they are a no-op combination that looks intentional -- reject it.
  if (flags.force && flags.allowStale) {
    io.error('Cannot combine --force with --allow-stale: --force ignores the cache entirely.', {
      exit: 2,
      code: 'CONFLICTING_FLAGS',
      suggestions: [
        'Use --force to fetch fresh content, or omit --force if you want a stale entry served ' +
          'within grace (with --allow-stale suppressing the exit-5 signal).',
      ],
    });
  }
}

/**
 * Fetch/serve each URL against the cache and return the command's `--json` data payload
 * (a single row, or an array for multi-URL batches with failures kept as rows).
 */
export async function runFetchCommandService(opts: FetchCommandServiceOptions): Promise<unknown> {
  const { dryRun, flags, io, spinner, urls } = opts;
  const run: FetchRun = {
    flags,
    io,
    spinner,
    currentTime: new Date(),
    tmpDir: dryRun ? mkdtempSync(join(tmpdir(), 'fnr-dry-run-')) : null,
    summaryLevel: loadSummaryLevel(io.configDir, io.cwd),
    dryRun,
    urlCount: urls.length,
  };

  try {
    const results = [];
    for (const url of urls) {
      try {
        results.push(await fetchSingleTarget(url, run));
      } catch (err) {
        results.push(failureRowOrRethrow(url, err, run));
      }
    }
    return finalizeBatch(results, (row) => 'error' in row);
  } finally {
    if (run.tmpDir) rmSync(run.tmpDir, { recursive: true, force: true });
  }
}

async function executeCacheHit(
  cached: ResearchArtifact,
  targetDir: string,
  run: FetchRun,
  secure?: RevalidateSecureWrite
): Promise<ResolvedFetchArtifact & { storageDir?: string; redirectedToGlobal: boolean }> {
  const { currentTime, flags, io } = run;
  const freshnessState = evaluateFreshnessWithMaxAge(cached, currentTime, {
    ttl: flags.ttl,
    maxAge: flags.maxAge,
  });

  if (freshnessState === 'fresh') {
    return { cacheStatus: 'hit', freshnessState, artifact: cached, redirectedToGlobal: false };
  }

  const revalidationResult = await revalidateCache(targetDir, cached, currentTime, {
    allowStale: flags.allowStale,
    ttlOverride: flags.ttl,
    rendered: flags.rendered,
    summaryLevel: run.summaryLevel,
    secure,
  });

  if (revalidationResult.status === 'stale') {
    const exitSuffix = revalidationResult.allowed ? '' : ` (exit ${EXIT_STALE_SERVED})`;
    io.warn(
      `Serving stale content within grace period${exitSuffix}: revalidation failed (${revalidationResult.error}).`
    );
    if (!revalidationResult.allowed) process.exitCode = EXIT_STALE_SERVED;
  }
  if (revalidationResult.redirectWarning) io.warn(revalidationResult.redirectWarning);

  return {
    cacheStatus: revalidationResult.status,
    freshnessState,
    artifact: revalidationResult.artifact,
    storageDir: revalidationResult.storageDir,
    redirectedToGlobal: Boolean(revalidationResult.redirectedToGlobal),
  };
}

async function executeCacheMiss(
  normalizedUrl: string,
  cacheKey: string,
  readRoots: string[],
  run: FetchRun
): Promise<ResearchArtifact> {
  const { currentTime, flags, summaryLevel } = run;
  const siteModule = detectSite(normalizedUrl);
  const useRendered = flags.rendered || Boolean(siteModule?.defaults?.rendered);

  let fetchResult: SiteFetchResult['fetchResult'];
  let extraction: SiteFetchResult['extraction'];
  let capture: CaptureOutcome | null = null;
  let siteFetch: SiteFetchResult | null = null;
  if (siteModule?.fetchPage) {
    // Custom site modules own their fetch/extract strategy; the generic capture path is skipped.
    siteFetch = await siteModule.fetchPage(normalizedUrl);
    ({ fetchResult, extraction } = siteFetch);
  } else {
    capture = await capturePage(normalizedUrl, { forceRendered: useRendered }, CAPTURE_DEPS);
    fetchResult = capture.fetchResult;
    extraction = capture.extraction;
  }

  const artifact = createArtifactFromFetch({
    url: normalizedUrl,
    normalizedUrl,
    cacheKey,
    fetchResult,
    extraction,
    tier: flags.tier,
    ttl: flags.ttl || null,
    currentTime,
    summaryLevel,
  });

  // --force bypasses the normal revalidation-hit path (it always re-fetches instead of
  // conditionally refreshing), so this "miss" may actually be overwriting a previously curated
  // entry. Read-only lookup, purely to carry topic/tags forward like every other refresh path
  // (revalidate.ts's preserveUserMetadata) — explicit --topic/--tags on this call still win.
  const priorArtifact = locateArtifact(readRoots, cacheKey, true)?.artifact ?? null;
  artifact.metadata.topic = flags.topic || priorArtifact?.metadata.topic || null;
  artifact.metadata.tags = flags.tags?.length ? flags.tags : (priorArtifact?.metadata.tags ?? []);
  artifact.metadata.site_module_id = siteModule?.id ?? null;
  if (capture) {
    applyCaptureMetadata(artifact, capture);
  } else if (siteFetch?.captureMethod) {
    applySiteFetchProvenance(artifact.metadata, siteFetch);
  } else if (useRendered) {
    artifact.metadata.capture_method = 'browser_fallback';
  }

  // Auto-tag from the fetched content when the caller supplied none, keeping cached pages
  // searchable by keyword. Explicit --tags always win (handled in applyAutoTags).
  return applyAutoTags(artifact);
}

async function resolveArtifact(
  target: ResolvedResearchTarget,
  run: FetchRun
): Promise<ResolvedFetchArtifact & { storageDir: string; redirectedToGlobal: boolean }> {
  const { cacheKey, located, normalizedUrl, roots } = target;
  if (located) {
    // Revalidate where the entry already lives; on dry-run use the throwaway dir so the cache is
    // never mutated. Project-located entries reuse persistArtifact (secret-scan + redirect) so a
    // refresh that gains a credential cannot stay in the committable project cache (#90).
    const revalDir = run.tmpDir ?? located.dataDir;
    const projectLocated = located.dataDir === roots.writeRoot && roots.mode === 'project';
    const secure: RevalidateSecureWrite | undefined = projectLocated
      ? { roots, dryRun: Boolean(run.tmpDir), scratchDir: run.tmpDir }
      : undefined;
    const hit = await executeCacheHit(located.artifact, revalDir, run, secure);
    return {
      cacheStatus: hit.cacheStatus,
      freshnessState: hit.freshnessState,
      artifact: hit.artifact,
      storageDir: hit.storageDir ?? located.dataDir,
      redirectedToGlobal: hit.redirectedToGlobal,
    };
  }

  const artifact = await executeCacheMiss(normalizedUrl, cacheKey, roots.readRoots, run);
  const write = persistArtifact({
    roots,
    cacheKey,
    artifact,
    dryRun: Boolean(run.tmpDir),
    kind: 'fetch',
    scratchDir: run.tmpDir,
  });
  if (write.redirectWarning) run.io.warn(write.redirectWarning);
  // No entry existed at lookup, so there is no prior freshness to report. 'none' (not
  // 'stale_expired') keeps the field honest -- nothing expired; the page was simply uncached and
  // has now been fetched fresh. Mirrors the `status` command's miss reporting.
  return {
    cacheStatus: 'miss',
    freshnessState: 'none',
    artifact,
    storageDir: write.dataDir,
    redirectedToGlobal: write.redirected,
  };
}

// Long references are split into searchable/inspectable section children whenever the page artifact
// is freshly written (T-22).
// ponytail: section persist is best-effort; failures are swallowed so chunking never fails the
// parent fetch. Upgrade: surface section errors in warnings/envelope when agents need them.
function persistSectionsIfFresh(
  targetDir: string,
  artifact: ResearchArtifact,
  cacheStatus: CacheHitStatus,
  run: FetchRun
): void {
  if (cacheStatus !== 'miss' && cacheStatus !== 'refreshed') return;
  try {
    persistSectionArtifacts(targetDir, artifact, run.currentTime, run.summaryLevel);
  } catch {
    /* ignored — see ponytail note above */
  }
}

function failureRowOrRethrow(url: string, err: unknown, run: FetchRun) {
  const { dryRun, io, spinner } = run;
  // Invalid URLs fail before ux.action.start; stopping a never-started spinner prints noise.
  if (!io.json && spinner.running()) spinner.stop('failed');
  if (run.urlCount === 1) {
    if (err instanceof Errors.CLIError) throw err;
    // Deep fetch/extract throws plain Errors; re-emit with actionable next steps.
    const message = describeError(err);
    const guidance = fetchFailureGuidance(message, url, io.bin);
    io.error(message, {
      exit: 1,
      code: 'FETCH_FAILED',
      suggestions: guidance?.suggestions,
      ref: guidance?.ref,
    });
  }
  const row =
    err instanceof Errors.CLIError
      ? buildFetchFailureResult({ url, dryRun, err })
      : buildFetchFailureFromCaught(io.bin, url, err, dryRun);
  // Human batches only get the spinner "failed" label unless we echo the reason. Mirror the
  // single-URL error format (message + Code: + Try this:) rather than a bare message, so a row
  // failure in a batch is exactly as actionable as it is standalone.
  if (!io.json) io.warn(formatErrorForJson(row.error));
  return row;
}

async function fetchSingleTarget(url: string, run: FetchRun) {
  const { dryRun, flags, io, spinner } = run;
  let target: ResolvedResearchTarget;
  try {
    target = resolveResearchTarget({
      configDir: io.configDir,
      cwd: io.cwd,
      dataDir: io.dataDir,
      url,
      flagOverride: flags.storage,
      lookup: !flags.force,
      // `dryRun` already merges explicit --dry-run with global read-only/plan mode
      // (BaseCommand.effectiveDryRun), so a corrupt entry hit while resolving the cache target is
      // never archived (renamed) on disk during either kind of no-write fetch.
      readOnly: dryRun,
    });
  } catch (err) {
    failInvalidUrl(io.error, url, (err as Error).message);
  }
  const { cacheKey, normalizedUrl, roots } = target;

  if (!io.json) {
    spinner.start('Fetching ' + normalizedUrl);
  }

  const { cacheStatus, freshnessState, artifact, storageDir, redirectedToGlobal } =
    await resolveArtifact(target, run);

  persistSectionsIfFresh(run.tmpDir ?? storageDir, artifact, cacheStatus, run);

  if (!io.json) {
    spinner.stop(FETCH_STATUS_LABEL[reportCacheStatus(cacheStatus, dryRun)]);
  }

  const resultData = buildFetchResultData({
    url,
    normalizedUrl,
    cacheKey,
    storageDir,
    storageMode: roots.mode,
    cacheStatus,
    freshnessState,
    format: flags.format,
    artifact,
    redirectedToGlobal,
    dryRun,
  });

  logHumanFetchResult({ io, resultData, cacheStatus, dryRun, normalizedUrl, run });

  return resultData;
}

/** True when this run launched Chrome on its own (no --rendered flag) to capture `url`, rather than
 * just reporting a stored artifact's capture history from an earlier run (cache 'hit'/'stale'/
 * 'revalidated'). Human mode uses this to decide whether the browser-fallback note would be accurate. */
function usedAutomaticBrowserFallback(
  cacheStatus: CacheHitStatus,
  captureMethod: string | null,
  rendered: boolean
): boolean {
  const capturedThisRun = cacheStatus === 'miss' || cacheStatus === 'refreshed';
  return capturedThisRun && captureMethod === 'browser_fallback' && !rendered;
}

/**
 * Human-mode-only side effects for one fetch result: dry-run notice, the automatic browser-fallback
 * note, extraction-quality warnings, the content itself, and the batch separator. No-op under
 * `--json` (that output goes through the envelope instead).
 */
function logHumanFetchResult(input: {
  io: CliIo;
  resultData: ReturnType<typeof buildFetchResultData>;
  cacheStatus: CacheHitStatus;
  dryRun: boolean;
  normalizedUrl: string;
  run: FetchRun;
}): void {
  const { io, resultData, cacheStatus, dryRun, normalizedUrl, run } = input;
  if (io.json) return;

  if (dryRun && cacheStatus !== 'hit' && cacheStatus !== 'stale') {
    io.log('[dry-run] Preview only — cache was not written.');
  }
  // Launching Chrome is real added latency and a real dependency that was otherwise invisible
  // outside --json; an explicit --rendered already tells the caller a browser was used.
  if (
    usedAutomaticBrowserFallback(cacheStatus, resultData.source.captureMethod, run.flags.rendered)
  ) {
    io.log('Note: used browser-rendered capture (static content was insufficient).');
  }
  for (const warning of extractionQualityWarnings(resultData.source.qualityNotes)) {
    io.warn(`${normalizedUrl}: ${warning}`);
  }
  io.log(resultData.content);
  const separator = batchSeparator(run.urlCount > 1);
  if (separator) {
    io.log(`\n${separator}\n`);
  }
}

// Copies Phase 2 capability provenance from a capture outcome onto the artifact metadata.
function applyCaptureMetadata(artifact: ResearchArtifact, capture: CaptureOutcome): void {
  const meta = artifact.metadata;
  meta.capture_method = capture.captureMethod;
  meta.docs_engine = capture.capabilities.docsEngine ?? null;
  meta.docs_framework = capture.capabilities.framework ?? null;
  meta.source_doc_url = capture.sourceDocUrl;
  meta.search_provider = capture.capabilities.search?.provider ?? null;
  if (capture.extraction.isIndexHub) meta.artifact_type = 'index';
  if (capture.sourceDocUrl && !meta.source_urls.includes(capture.sourceDocUrl)) {
    meta.source_urls.push(capture.sourceDocUrl);
  }
}
