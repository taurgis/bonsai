import { Args, Flags, ux, Errors } from '@oclif/core';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BaseCommand } from '../base-command.js';
import { finalizeBatch } from '../lib/batch.js';
import { enrichRowErrorEnvelope } from '../lib/envelope.js';
import {
  buildFetchFailureFromCaught,
  buildFetchFailureResult,
  buildFetchResultData,
  describeError,
  FETCH_STATUS_LABEL,
  fetchFailureGuidance,
  reportCacheStatus,
} from '../lib/research/fetch-result.js';
import { writeArtifact, type LocatedArtifact } from '../lib/research/storage.js';
import { loadStoreRoots, type StoreRoots } from '../lib/research/store-roots.js';
import { writeArtifactSecurely } from '../lib/research/secure-write.js';
import { loadSummaryLevel, type StorageMode, type SummaryLevel } from '../lib/config/index.js';
import {
  evaluateFreshness,
  checkMaxAgeExpired,
  durationFlagError,
} from '../lib/research/freshness.js';
import { revalidateCache, createArtifactFromFetch } from '../lib/research/revalidate.js';
import { fetchStaticHtml, fetchText } from '../lib/research/fetcher.js';
import { fetchRenderedHtml } from '../lib/research/browser.js';
import { capturePage, type CaptureDeps } from '../lib/research/capture.js';
import { persistSectionArtifacts } from '../lib/research/docs/section-artifacts.js';
import { applyAutoTags } from '../lib/research/keywords.js';
import { detectSite } from '../sites/index.js';
import { applySiteFetchProvenance, type SiteFetchResult } from '../sites/types.js';

const CAPTURE_DEPS: CaptureDeps = {
  fetchStatic: (url) => fetchStaticHtml(url),
  fetchRendered: (url) => fetchRenderedHtml(url),
  fetchText: (url) => fetchText(url),
};

export default class FetchCommand extends BaseCommand<typeof FetchCommand> {
  static id = 'fetch';
  static hidden = true;
  static summary = 'Fetch and cache a URL as research Markdown for LLM ingestion.';
  static description =
    'Scrapes the specified URL, strips HTML boilerplate, converts the semantic payload into clean Markdown format, and caches the result locally using dynamic TTL rules.\n\nUsually invoked via the shorthand `bonsai <url>` rather than `bonsai fetch <url>`.';

  static examples = [
    {
      description: 'research a URL with detailed output, tagged with topic and tags',
      command:
        '<%= config.bin %> https://docs.nestjs.com/ --topic "Backend Frameworks" --tags "Node" --tags "NestJS" --format detailed --ttl 30d',
    },
    {
      description:
        'research a volatile page with compressed output and short TTL, returned as JSON',
      command:
        '<%= config.bin %> https://news.ycombinator.com/ --format compressed --ttl 2h --json',
    },
  ];

  static strict = false;

  static args = {
    url: Args.string({
      required: true,
      description: 'the full HTTP/HTTPS URL of the web page to research',
    }),
  };

  static flags = {
    topic: Flags.string({
      char: 't',
      description: 'the main category/topic of the research for metadata tagging',
    }),
    tags: Flags.string({
      char: 'g',
      description: 'taxonomic tags for this research (can be repeated)',
      multiple: true,
    }),
    format: Flags.option({
      char: 'f',
      description: 'desired data density',
      options: ['compressed', 'detailed'] as const,
      default: 'compressed',
    })(),
    tier: Flags.option({
      description: 'freshness tier policy',
      options: ['stable', 'standard', 'volatile'] as const,
      default: 'standard',
    })(),
    ttl: Flags.string({
      char: 'l',
      description: 'predicted lifespan: number + h/d/w/m/y (m = months), e.g. "2h", "7d", "6m"',
    }),
    'max-age': Flags.string({
      description: 'maximum age of cache to accept (e.g., "1d", "30d")',
    }),
    force: Flags.boolean({
      description: 'force a fresh fetch, ignoring any cached entries',
      default: false,
    }),
    'dry-run': Flags.boolean({
      description: 'perform validation and fetch without saving to local cache',
      default: false,
    }),
    'allow-stale': Flags.boolean({
      description: 'allow serving stale cache if the remote server is unreachable',
      default: false,
    }),
    rendered: Flags.boolean({
      description: 'force using a browser-rendered scraping path for dynamic pages',
      default: false,
    }),
    storage: Flags.option({
      description: 'override where this result is cached (secrets always stored globally)',
      options: ['global', 'project'] as const,
    })(),
  };

  static stdoutIsPrimaryData = true;

  protected override envelopeCommandId(): string {
    return this.config.bin;
  }

  private async executeCacheHit(
    cached: any,
    targetDir: string,
    currentTime: Date,
    summaryLevel: SummaryLevel
  ): Promise<{ cacheStatus: any; freshnessState: any; artifact: any }> {
    const { ttl, 'max-age': maxAge, 'allow-stale': allowStale, rendered } = this.flags;

    const isExpired = checkMaxAgeExpired(cached, currentTime, maxAge);
    const freshnessState = isExpired
      ? 'stale_expired'
      : evaluateFreshness(cached.metadata, currentTime, ttl);

    if (freshnessState === 'fresh') {
      return { cacheStatus: 'hit', freshnessState, artifact: cached };
    }

    const revalResult = await revalidateCache(targetDir, cached, currentTime, {
      allowStale: Boolean(allowStale),
      ttlOverride: ttl,
      rendered: Boolean(rendered),
      summaryLevel,
    });

    handleStaleRevalidationResult(this, revalResult);

    return {
      cacheStatus: revalResult.status,
      freshnessState,
      artifact: revalResult.artifact,
    };
  }

  private async executeCacheMiss(
    normalizedUrl: string,
    currentTime: Date,
    cacheKey: string,
    summaryLevel: SummaryLevel
  ): Promise<any> {
    const { topic, tags, tier, ttl, rendered } = this.flags;

    const siteModule = detectSite(normalizedUrl);
    const useRendered = rendered || Boolean(siteModule?.defaults?.rendered);

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
      tier,
      ttl || null,
      currentTime,
      summaryLevel
    );

    artifact.metadata.topic = topic || null;
    artifact.metadata.tags = tags || [];
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

  /**
   * When a multi-URL batch has any per-URL failure, keep the result array (including hits) and
   * surface FETCH_FAILED on the envelope — same batch contract as status/inspect CACHE_MISS.
   */
  protected override toSuccessJson(data: unknown): Record<string, unknown> {
    return enrichRowErrorEnvelope(this.baseSuccessJson(data), data);
  }

  // Validates fetch flags up front, exiting with code 2 on a malformed or contradictory value.
  private validateFetchFlags(
    ttl?: string,
    maxAge?: string,
    force?: boolean,
    allowStale?: boolean
  ): void {
    for (const msg of [durationFlagError('--ttl', ttl), durationFlagError('--max-age', maxAge)]) {
      if (msg) this.error(msg, { exit: 2, code: 'INVALID_DURATION' });
    }
    // --force skips cache lookup; --allow-stale only applies when serving a stale entry after a
    // failed revalidation. Together they are a no-op combination that looks intentional — reject it.
    if (force && allowStale) {
      this.error('Cannot combine --force with --allow-stale: --force ignores the cache entirely.', {
        exit: 2,
        code: 'CONFLICTING_FLAGS',
      });
    }
  }

  // Re-emit a runtime fetch failure with actionable next steps. Deep fetch/extract code throws plain
  // Errors that otherwise reach the user as a bare "what broke" line with no "what to do"; this
  // attaches recovery hints (e.g. import an auth-blocked page). Everything reaching here is a runtime
  // failure — validation errors (bad flags/URL) exit before the try — so the contract's runtime code
  // (1) applies. Suggestions surface for humans ("Try this:") and under --json via toErrorJson.
  //
  // Uses `describeError` rather than `err.message` alone: Node/undici's fetch wraps transport
  // failures (DNS, refused connections, a proxy that won't tunnel to the host) in a generic
  // "fetch failed" TypeError with the real reason nested in `.cause`, so reading only the top
  // message would surface a content-free "fetch failed" for exactly the failures a user most
  // needs a hint for.
  private emitFetchError(err: unknown, url: string): never {
    const message = describeError(err);
    const guidance = fetchFailureGuidance(message, url, this.config.bin);
    this.error(message, {
      exit: 1,
      code: 'FETCH_FAILED',
      suggestions: guidance?.suggestions,
      ref: guidance?.ref,
    });
  }

  // Serves the cache when a fresh/revalidatable entry exists, otherwise fetches fresh. Reads fall
  // back project→global; the resolved artifact is returned with the dir it lives in / landed in.
  private async resolveArtifact(
    normalizedUrl: string,
    cacheKey: string,
    roots: StoreRoots,
    tmpDir: string | null,
    currentTime: Date,
    located: LocatedArtifact | null,
    summaryLevel: SummaryLevel
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
      // gains a secret is not re-routed — only first-time project writes are scanned.
      const revalDir = tmpDir ?? located.dataDir;
      const hit = await this.executeCacheHit(located.artifact, revalDir, currentTime, summaryLevel);
      return { ...hit, storageDir: located.dataDir, redirectedToGlobal: false };
    }

    const artifact = await this.executeCacheMiss(
      normalizedUrl,
      currentTime,
      cacheKey,
      summaryLevel
    );
    const { dir, redirectedToGlobal } = this.persistFreshArtifact(
      roots,
      tmpDir,
      cacheKey,
      artifact
    );
    // No entry existed at lookup, so there is no prior freshness to report. 'none' (not
    // 'stale_expired') keeps the field honest — nothing expired; the page was simply uncached and
    // has now been fetched fresh. Mirrors the `status` command's miss reporting.
    return {
      cacheStatus: 'miss',
      freshnessState: 'none',
      artifact,
      storageDir: dir,
      redirectedToGlobal,
    };
  }

  // Writes a freshly fetched artifact, honoring dry-run (throwaway dir) and the secret-safety
  // redirect (project→global). Returns the data dir reported to the user and whether a redirect
  // occurred (so the JSON envelope mirrors `import`).
  private persistFreshArtifact(
    roots: StoreRoots,
    tmpDir: string | null,
    cacheKey: string,
    artifact: any
  ): { dir: string; redirectedToGlobal: boolean } {
    if (tmpDir) {
      const result = writeArtifactSecurely(roots, cacheKey, artifact, { dryRun: true });
      if (result.redirected) {
        this.warn(
          `Detected ${result.secretLabel} in the page content; would store in the global cache instead of the project to avoid committing secrets.`
        );
      }
      writeArtifact(tmpDir, cacheKey, artifact);
      // Report the real would-be location, not the throwaway dir that is about to be deleted.
      return { dir: result.dataDir, redirectedToGlobal: result.redirected };
    }
    const result = writeArtifactSecurely(roots, cacheKey, artifact);
    if (result.redirected) {
      this.warn(
        `Detected ${result.secretLabel} in the page content; stored in the global cache instead of the project to avoid committing secrets.`
      );
    }
    return { dir: result.dataDir, redirectedToGlobal: result.redirected };
  }

  // Long references are split into searchable/inspectable section children whenever the page artifact
  // is freshly written (T-22). Best-effort: never let chunking break the main result.
  private persistSectionsIfFresh(
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

  async run(): Promise<unknown> {
    const urls = this.parsedArgv;
    const { ttl, 'max-age': maxAge, force, 'allow-stale': allowStale } = this.flags;

    this.validateFetchFlags(ttl, maxAge, force, allowStale);
    const dryRun = this.effectiveDryRun(this.flags['dry-run']);

    const summaryLevel = loadSummaryLevel(this.config.configDir, process.cwd());
    const tmpDir = dryRun ? mkdtempSync(join(tmpdir(), 'fnr-dry-run-')) : null;
    const currentTime = new Date();
    const batch = urls.length > 1;
    const ctx = { currentTime, tmpDir, summaryLevel, dryRun };

    try {
      const results = [];
      for (const url of urls) {
        try {
          results.push(await this.fetchSingleTarget(url, ctx));
        } catch (err) {
          results.push(this.failureRowOrRethrow(url, err, dryRun, batch));
        }
      }
      return finalizeBatch(results, (r) => Boolean(r?.error));
    } finally {
      if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  /**
   * Multi-URL batches keep prior successes as failure rows. Flag validation runs before this loop,
   * so every error that reaches here is per-URL — including INVALID_URL / MISSING_URL_SCHEME.
   */
  private failureRowOrRethrow(url: string, err: unknown, dryRun: boolean, batch: boolean) {
    // Invalid URLs fail before ux.action.start; stopping a never-started spinner prints noise.
    if (!this.jsonEnabled() && ux.action.running) ux.action.stop('failed');
    if (!batch) {
      if (err instanceof Errors.CLIError) throw err;
      this.emitFetchError(err, url);
    }
    const row =
      err instanceof Errors.CLIError
        ? buildFetchFailureResult({ bin: this.config.bin, url, dryRun, err })
        : buildFetchFailureFromCaught(this.config.bin, url, err, dryRun);
    // Human batches only get the spinner "failed" label unless we echo the reason.
    if (!this.jsonEnabled()) this.warn(row.error.message);
    return row;
  }

  private async fetchSingleTarget(
    url: string,
    ctx: {
      currentTime: Date;
      tmpDir: string | null;
      summaryLevel: SummaryLevel;
      dryRun: boolean;
    }
  ): Promise<any> {
    const { currentTime, tmpDir, summaryLevel, dryRun } = ctx;
    const format = this.flags.format;
    const target = this.resolveResearchTargetOrFail(url, {
      flagOverride: this.flags.storage as StorageMode | undefined,
      lookup: !this.flags.force,
    });

    const { cacheKey, located, normalizedUrl, roots } = target;

    if (!this.jsonEnabled()) {
      ux.action.start('Fetching ' + normalizedUrl);
    }

    const { cacheStatus, freshnessState, artifact, storageDir, redirectedToGlobal } =
      await this.resolveArtifact(
        normalizedUrl,
        cacheKey,
        roots,
        tmpDir,
        currentTime,
        located,
        summaryLevel
      );

    this.persistSectionsIfFresh(
      tmpDir ?? storageDir,
      artifact,
      currentTime,
      cacheStatus,
      summaryLevel
    );

    if (!this.jsonEnabled()) {
      const reported = reportCacheStatus(cacheStatus, dryRun);
      ux.action.stop(FETCH_STATUS_LABEL[reported] ?? reported);
    }

    const resultData = buildFetchResultData({
      bin: this.config.bin,
      url,
      normalizedUrl,
      cacheKey,
      storageDir,
      storageMode: roots.mode,
      cacheStatus,
      freshnessState,
      format,
      artifact,
      redirectedToGlobal,
      dryRun,
    });

    if (!this.jsonEnabled()) {
      if (dryRun && cacheStatus !== 'hit' && cacheStatus !== 'stale') {
        this.log('[dry-run] Preview only — cache was not written.');
      }
      this.log(resultData.content);
      if (this.parsedArgv.length > 1) {
        this.log('\n' + '='.repeat(40) + '\n');
      }
    }

    return resultData;
  }
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

function handleStaleRevalidationResult(command: any, revalResult: any): void {
  if (revalResult.status !== 'stale') return;
  if (revalResult.allowed) {
    command.warn(
      `Serving stale content within grace period: revalidation failed (${revalResult.error}).`
    );
  } else {
    command.warn(
      `Serving stale content within grace period (exit 5): revalidation failed (${revalResult.error}).`
    );
    process.exitCode = 5;
  }
}
