import { Errors } from '@oclif/core';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { finalizeBatch } from '../batch.js';
import type { StorageMode, SummaryLevel } from '../config/index.js';
import { loadSummaryLevel } from '../config/index.js';
import {
  buildFetchFailureFromCaught,
  buildFetchFailureResult,
  buildFetchResultData,
  describeError,
  FETCH_STATUS_LABEL,
  fetchFailureGuidance,
  reportCacheStatus,
} from './fetch-result.js';
import { checkMaxAgeExpired, durationFlagError, evaluateFreshness } from './freshness.js';
import { fetchRenderedHtml } from './browser.js';
import { capturePage, type CaptureDeps } from './capture.js';
import { persistSectionArtifacts } from './docs/section-artifacts.js';
import { fetchStaticHtml, fetchText } from './fetcher.js';
import { applyAutoTags } from './keywords.js';
import { persistArtifact } from './persist-artifact.js';
import { createArtifactFromFetch, revalidateCache } from './revalidate.js';
import { resolveResearchTarget } from './resolve-target.js';
import type { LocatedArtifact } from './storage.js';
import type { StoreRoots } from './store-roots.js';
import { looksLikeSchemelessUrl } from './url.js';
import { detectSite } from '../../sites/index.js';
import { applySiteFetchProvenance, type SiteFetchResult } from '../../sites/types.js';

const CAPTURE_DEPS: CaptureDeps = {
  fetchStatic: (url) => fetchStaticHtml(url),
  fetchRendered: (url) => fetchRenderedHtml(url),
  fetchText: (url) => fetchText(url),
};

export interface CliIo {
  bin: string;
  configDir: string | undefined;
  dataDir: string;
  cwd: string;
  json: boolean;
  warn(msg: string): void;
  log(msg: string): void;
  error(
    msg: string,
    opts: { exit: number; code?: string; suggestions?: string[]; ref?: string }
  ): never;
}

export interface FetchCommandSpinner {
  running(): boolean;
  start(msg: string): void;
  stop(msg?: string): void;
}

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

export interface FetchCommandServiceOptions {
  urls: string[];
  flags: FetchCommandFlags;
  dryRun: boolean;
  io: CliIo;
  spinner: FetchCommandSpinner;
}

export function validateFetchCommandFlags(io: CliIo, flags: FetchCommandFlags): void {
  for (const msg of [
    durationFlagError('--ttl', flags.ttl),
    durationFlagError('--max-age', flags.maxAge),
  ]) {
    if (msg) io.error(msg, { exit: 2, code: 'INVALID_DURATION' });
  }
  // --force skips cache lookup; --allow-stale only applies when serving a stale entry after a
  // failed revalidation. Together they are a no-op combination that looks intentional -- reject it.
  if (flags.force && flags.allowStale) {
    io.error('Cannot combine --force with --allow-stale: --force ignores the cache entirely.', {
      exit: 2,
      code: 'CONFLICTING_FLAGS',
      suggestions: [
        'Use --force to fetch fresh content, or omit --force when you want --allow-stale fallback.',
      ],
    });
  }
}

export async function runFetchCommandService(opts: FetchCommandServiceOptions): Promise<unknown> {
  const { dryRun, flags, io, spinner, urls } = opts;
  const summaryLevel = loadSummaryLevel(io.configDir, io.cwd);
  const tmpDir = dryRun ? mkdtempSync(join(tmpdir(), 'fnr-dry-run-')) : null;
  const currentTime = new Date();
  const batch = urls.length > 1;
  const ctx = { currentTime, tmpDir, summaryLevel, dryRun };

  try {
    const results = [];
    for (const url of urls) {
      try {
        results.push(
          await fetchSingleTarget(url, ctx, { flags, io, spinner, urlCount: urls.length })
        );
      } catch (err) {
        results.push(failureRowOrRethrow(url, err, dryRun, batch, io, spinner));
      }
    }
    return finalizeBatch(results, (r) => Boolean(r?.error));
  } finally {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function executeCacheHit(
  cached: any,
  targetDir: string,
  currentTime: Date,
  summaryLevel: SummaryLevel,
  flags: FetchCommandFlags,
  io: CliIo
): Promise<{ cacheStatus: any; freshnessState: any; artifact: any }> {
  const isExpired = checkMaxAgeExpired(cached, currentTime, flags.maxAge);
  const freshnessState = isExpired
    ? 'stale_expired'
    : evaluateFreshness(cached.metadata, currentTime, flags.ttl);

  if (freshnessState === 'fresh') {
    return { cacheStatus: 'hit', freshnessState, artifact: cached };
  }

  const revalResult = await revalidateCache(targetDir, cached, currentTime, {
    allowStale: flags.allowStale,
    ttlOverride: flags.ttl,
    rendered: flags.rendered,
    summaryLevel,
  });

  handleStaleRevalidationResult(io, revalResult);

  return {
    cacheStatus: revalResult.status,
    freshnessState,
    artifact: revalResult.artifact,
  };
}

async function executeCacheMiss(
  normalizedUrl: string,
  currentTime: Date,
  cacheKey: string,
  summaryLevel: SummaryLevel,
  flags: FetchCommandFlags
): Promise<any> {
  const siteModule = detectSite(normalizedUrl);
  const useRendered = flags.rendered || Boolean(siteModule?.defaults?.rendered);

  let fetchResult: SiteFetchResult['fetchResult'];
  let extraction: SiteFetchResult['extraction'];
  let capture: Awaited<ReturnType<typeof capturePage>> | null = null;
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

  const artifact = createArtifactFromFetch(
    normalizedUrl,
    normalizedUrl,
    cacheKey,
    fetchResult,
    extraction,
    flags.tier,
    flags.ttl || null,
    currentTime,
    summaryLevel
  );

  artifact.metadata.topic = flags.topic || null;
  artifact.metadata.tags = flags.tags || [];
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

function resolveArtifactTargetOrFail(io: CliIo, url: string, flags: FetchCommandFlags) {
  try {
    return resolveResearchTarget({
      configDir: io.configDir,
      cwd: io.cwd,
      dataDir: io.dataDir,
      url,
      flagOverride: flags.storage,
      lookup: !flags.force,
    });
  } catch (err) {
    failInvalidUrl(io, url, (err as Error).message);
  }
}

// Single exit point matching BaseCommand.failInvalidUrl so batch rows/error envelopes stay stable.
function failInvalidUrl(io: CliIo, url: string, message: string): never {
  if (looksLikeSchemelessUrl(url)) {
    io.error(message, {
      exit: 2,
      code: 'MISSING_URL_SCHEME',
      suggestions: [`Use a full URL: https://${url}`],
    });
  }
  io.error(`Invalid URL: ${message}`, {
    exit: 2,
    code: 'INVALID_URL',
    suggestions: ['Provide a valid http:// or https:// URL.'],
  });
}

async function resolveArtifact(
  normalizedUrl: string,
  cacheKey: string,
  roots: StoreRoots,
  tmpDir: string | null,
  currentTime: Date,
  located: LocatedArtifact | null,
  summaryLevel: SummaryLevel,
  flags: FetchCommandFlags,
  io: CliIo
): Promise<{
  cacheStatus: any;
  freshnessState: any;
  artifact: any;
  storageDir: string;
  redirectedToGlobal: boolean;
}> {
  if (located) {
    // Revalidate where the entry already lives; on dry-run use the throwaway dir so the cache is
    // never mutated. ponytail: revalidation rewrites in place, so a refreshed project entry that
    // gains a secret is not re-routed -- only first-time project writes are scanned.
    const revalDir = tmpDir ?? located.dataDir;
    const hit = await executeCacheHit(
      located.artifact,
      revalDir,
      currentTime,
      summaryLevel,
      flags,
      io
    );
    return { ...hit, storageDir: located.dataDir, redirectedToGlobal: false };
  }

  const artifact = await executeCacheMiss(
    normalizedUrl,
    currentTime,
    cacheKey,
    summaryLevel,
    flags
  );
  const { dir, redirectedToGlobal } = persistFreshArtifact(roots, tmpDir, cacheKey, artifact, io);
  // No entry existed at lookup, so there is no prior freshness to report. 'none' (not
  // 'stale_expired') keeps the field honest -- nothing expired; the page was simply uncached and
  // has now been fetched fresh. Mirrors the `status` command's miss reporting.
  return {
    cacheStatus: 'miss',
    freshnessState: 'none',
    artifact,
    storageDir: dir,
    redirectedToGlobal,
  };
}

function persistFreshArtifact(
  roots: StoreRoots,
  tmpDir: string | null,
  cacheKey: string,
  artifact: any,
  io: CliIo
): { dir: string; redirectedToGlobal: boolean } {
  const result = persistArtifact({
    roots,
    cacheKey,
    artifact,
    dryRun: Boolean(tmpDir),
    kind: 'fetch',
    scratchDir: tmpDir,
  });
  if (result.redirectWarning) io.warn(result.redirectWarning);
  // Report the real would-be location, not the throwaway dir that is about to be deleted.
  return { dir: result.dataDir, redirectedToGlobal: result.redirected };
}

// Long references are split into searchable/inspectable section children whenever the page artifact
// is freshly written (T-22). Best-effort: never let chunking break the main result.
function persistSectionsIfFresh(
  targetDir: string,
  artifact: any,
  currentTime: Date,
  cacheStatus: any,
  summaryLevel: SummaryLevel
): void {
  if (cacheStatus !== 'miss' && cacheStatus !== 'refreshed') return;
  try {
    persistSectionArtifacts(targetDir, artifact, currentTime, summaryLevel);
  } catch {
    /* section generation is non-essential; ignore failures */
  }
}

// Re-emit a runtime fetch failure with actionable next steps. Deep fetch/extract code throws plain
// Errors that otherwise reach the user as a bare "what broke" line with no "what to do".
function emitFetchError(err: unknown, url: string, io: CliIo): never {
  const message = describeError(err);
  const guidance = fetchFailureGuidance(message, url, io.bin);
  io.error(message, {
    exit: 1,
    code: 'FETCH_FAILED',
    suggestions: guidance?.suggestions,
    ref: guidance?.ref,
  });
}

/**
 * Multi-URL batches keep prior successes as failure rows. Flag validation runs before this loop,
 * so every error that reaches here is per-URL -- including INVALID_URL / MISSING_URL_SCHEME.
 */
function failureRowOrRethrow(
  url: string,
  err: unknown,
  dryRun: boolean,
  batch: boolean,
  io: CliIo,
  spinner: FetchCommandSpinner
) {
  // Invalid URLs fail before ux.action.start; stopping a never-started spinner prints noise.
  if (!io.json && spinner.running()) spinner.stop('failed');
  if (!batch) {
    if (err instanceof Errors.CLIError) throw err;
    emitFetchError(err, url, io);
  }
  const row =
    err instanceof Errors.CLIError
      ? buildFetchFailureResult({ bin: io.bin, url, dryRun, err })
      : buildFetchFailureFromCaught(io.bin, url, err, dryRun);
  // Human batches only get the spinner "failed" label unless we echo the reason.
  if (!io.json) io.warn(row.error.message);
  return row;
}

async function fetchSingleTarget(
  url: string,
  ctx: {
    currentTime: Date;
    tmpDir: string | null;
    summaryLevel: SummaryLevel;
    dryRun: boolean;
  },
  deps: {
    flags: FetchCommandFlags;
    io: CliIo;
    spinner: FetchCommandSpinner;
    urlCount: number;
  }
): Promise<any> {
  const { currentTime, tmpDir, summaryLevel, dryRun } = ctx;
  const { flags, io, spinner, urlCount } = deps;
  const target = resolveArtifactTargetOrFail(io, url, flags);

  const { cacheKey, located, normalizedUrl, roots } = target;

  if (!io.json) {
    spinner.start('Fetching ' + normalizedUrl);
  }

  const { cacheStatus, freshnessState, artifact, storageDir, redirectedToGlobal } =
    await resolveArtifact(
      normalizedUrl,
      cacheKey,
      roots,
      tmpDir,
      currentTime,
      located,
      summaryLevel,
      flags,
      io
    );

  persistSectionsIfFresh(tmpDir ?? storageDir, artifact, currentTime, cacheStatus, summaryLevel);

  if (!io.json) {
    const reported = reportCacheStatus(cacheStatus, dryRun);
    spinner.stop(FETCH_STATUS_LABEL[reported] ?? reported);
  }

  const resultData = buildFetchResultData({
    bin: io.bin,
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

  if (!io.json) {
    if (dryRun && cacheStatus !== 'hit' && cacheStatus !== 'stale') {
      io.log('[dry-run] Preview only — cache was not written.');
    }
    io.log(resultData.content);
    if (urlCount > 1) {
      io.log('\n' + '='.repeat(40) + '\n');
    }
  }

  return resultData;
}

// Copies Phase 2 capability provenance from a capture outcome onto the artifact metadata.
function applyCaptureMetadata(
  artifact: any,
  capture: Awaited<ReturnType<typeof capturePage>>
): void {
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

function handleStaleRevalidationResult(io: CliIo, revalResult: any): void {
  if (revalResult.status !== 'stale') return;
  if (revalResult.allowed) {
    io.warn(
      `Serving stale content within grace period: revalidation failed (${revalResult.error}).`
    );
  } else {
    io.warn(
      `Serving stale content within grace period (exit 5): revalidation failed (${revalResult.error}).`
    );
    process.exitCode = 5;
  }
}
