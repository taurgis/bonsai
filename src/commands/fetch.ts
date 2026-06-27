import { Args, Flags, ux } from '@oclif/core';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BaseCommand } from '../base-command.js';
import { writeArtifact, getArtifactPath, type LocatedArtifact } from '../lib/research/storage.js';
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
import type { SiteFetchResult } from '../sites/types.js';

const CAPTURE_DEPS: CaptureDeps = {
  fetchStatic: (url) => fetchStaticHtml(url),
  fetchRendered: (url) => fetchRenderedHtml(url),
  fetchText: (url) => fetchText(url),
};

export default class FetchCommand extends BaseCommand<typeof FetchCommand> {
  static id = 'fetch';
  static hidden = true;
  static summary = 'An advanced, locally cached web research tool optimized for LLM ingestion.';
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
    if (siteModule?.fetchPage) {
      // Custom site modules own their fetch/extract strategy; the generic capture path is skipped.
      ({ fetchResult, extraction } = await siteModule.fetchPage(normalizedUrl));
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
    } else if (useRendered) {
      artifact.metadata.capture_method = 'browser_fallback';
    }

    // Auto-tag from the fetched content when the caller supplied none, keeping cached pages
    // searchable by keyword. Explicit --tags always win (handled in applyAutoTags).
    return applyAutoTags(artifact);
  }

  private buildResultData(
    url: string,
    normalizedUrl: string,
    cacheKey: string,
    storageDir: string,
    storageMode: StorageMode,
    cacheStatus: any,
    freshnessState: any,
    format: any,
    artifact: any,
    content: string,
    redirectedToGlobal: boolean
  ): any {
    return {
      schemaVersion: 1,
      command: this.config.bin,
      cache: {
        key: cacheKey,
        status: cacheStatus,
        freshness: freshnessState,
        path: getArtifactPath(storageDir, cacheKey),
        storage: storageMode,
        redirectedToGlobal,
      },
      source: {
        url,
        normalizedUrl,
        captureMethod: artifact.metadata.capture_method,
        extractionStatus: artifact.metadata.extraction_status,
        extractionConfidence: artifact.metadata.extraction_confidence,
        qualityNotes: artifact.metadata.quality_notes,
        fetchedAt: artifact.metadata.fetched_at,
        validatedAt: artifact.metadata.validated_at,
        staleAfter: artifact.metadata.stale_after,
      },
      artifactType: artifact.metadata.artifact_type,
      docsEngine: artifact.metadata.docs_engine,
      docsFramework: artifact.metadata.docs_framework,
      sourceDocUrl: artifact.metadata.source_doc_url,
      searchProvider: artifact.metadata.search_provider,
      format,
      tokenEstimate:
        format === 'compressed'
          ? artifact.metadata.token_estimate.compressed
          : artifact.metadata.token_estimate.detailed,
      content,
    };
  }

  // Validates the duration flags up front, exiting with code 2 on a malformed value.
  private validateDurationFlags(ttl?: string, maxAge?: string): void {
    for (const msg of [durationFlagError('--ttl', ttl), durationFlagError('--max-age', maxAge)]) {
      if (msg) this.error(msg, { exit: 2, code: 'INVALID_DURATION' });
    }
  }

  // Re-emit a runtime fetch failure with actionable next steps. Deep fetch/extract code throws plain
  // Errors that otherwise reach the user as a bare "what broke" line with no "what to do"; this
  // attaches recovery hints (e.g. import an auth-blocked page). Everything reaching here is a runtime
  // failure — validation errors (bad flags/URL) exit before the try — so the contract's runtime code
  // (1) applies. Suggestions render on stderr for humans only; under --json the envelope carries just
  // the message (toErrorJson), so machine output is unchanged.
  private emitFetchError(err: unknown, url: string): never {
    const message = err instanceof Error ? err.message : String(err);
    const guidance = fetchFailureGuidance(message, url);
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
      writeArtifact(tmpDir, cacheKey, artifact);
      // Report the real would-be location, not the throwaway dir that is about to be deleted.
      return { dir: roots.writeRoot, redirectedToGlobal: false };
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
    const { url } = this.args;
    const { format, ttl, 'max-age': maxAge, 'dry-run': dryRun } = this.flags;

    this.validateDurationFlags(ttl, maxAge);

    const target = this.resolveResearchTargetOrFail(url, {
      flagOverride: this.flags.storage as StorageMode | undefined,
      lookup: !this.flags.force,
    });

    const { cacheKey, located, normalizedUrl, roots } = target;
    const summaryLevel = loadSummaryLevel(this.config.configDir, process.cwd());
    const tmpDir = dryRun ? mkdtempSync(join(tmpdir(), 'fnr-dry-run-')) : null;
    const currentTime = new Date();

    try {
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
        const CACHE_STATUS_LABEL: Record<string, string> = {
          hit: 'cached',
          miss: 'done',
          refreshed: 'refreshed',
          revalidated: 'revalidated',
          stale: 'served stale',
        };
        ux.action.stop(CACHE_STATUS_LABEL[cacheStatus] ?? cacheStatus);
      }

      const content = format === 'compressed' ? artifact.compressed : artifact.detailed;
      const resultData = this.buildResultData(
        url,
        normalizedUrl,
        cacheKey,
        storageDir,
        roots.mode,
        cacheStatus,
        freshnessState,
        format,
        artifact,
        content,
        redirectedToGlobal
      );

      if (!this.jsonEnabled()) {
        this.log(content);
      }
      return resultData;
    } catch (err) {
      if (!this.jsonEnabled()) {
        ux.action.stop('failed');
      }
      // Stale-serve (exit 5) signals via process.exitCode and never throws, so it bypasses this
      // path; only genuine fetch/extract failures land here and get classified guidance. Use the
      // normalized URL in hints so the copy-paste command is canonical (and never echoes raw,
      // unsanitized user input back to the terminal).
      this.emitFetchError(err, normalizedUrl);
    } finally {
      if (tmpDir) {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    }
  }
}

// Maps a runtime fetch failure to recovery steps keyed off its message. Returns undefined for
// unrecognized failures, which then surface with their original message and no extra hint. The
// patterns match the thrown text in fetcher.ts/browser.ts; keep them in sync if those messages
// change. Resolutions mirror the published troubleshooting guide.
export function fetchFailureGuidance(
  message: string,
  url: string
): { suggestions: string[]; ref?: string } | undefined {
  const ref = 'https://taurgis.github.io/bonsai/troubleshooting';
  // Name the pipe step explicitly: bare `import --stdin` blocks waiting for input, so a reader (or
  // an agent) running the hint verbatim would hang. Show the content being piped in from a file.
  const importHint = `Open it in a browser, save the page, then import it: cat page.md | bonsai import ${url} --stdin`;

  // 401/403: an auth wall or anti-scraping WAF. Bonsai has no authenticated-fetch path in v1.
  if (/failed with status 40[13]\b/.test(message)) {
    return {
      suggestions: ['The page requires authentication or blocks automated requests.', importHint],
      ref,
    };
  }
  if (/failed with status 404\b/.test(message)) {
    return { suggestions: ['Check the URL is correct and the page still exists.'] };
  }
  if (/failed with status 5\d\d\b/.test(message)) {
    return {
      suggestions: ['The server returned an error. Retry later or verify the host is healthy.'],
    };
  }
  // Server returned a non-HTML body (JSON, binary, or no Content-Type at all). Scope the opener to
  // the real failure: --rendered does produce HTML, so "only scrapes HTML" would read as misleading.
  if (/Rejected content type|does not look like HTML/.test(message)) {
    return {
      suggestions: [
        'The server returned a non-HTML response (e.g. JSON or binary).',
        'If the page is rendered by client-side JavaScript, retry with --rendered.',
        importHint,
      ],
      ref,
    };
  }
  if (/DNS resolution failed/.test(message)) {
    return {
      suggestions: ['Check the hostname is spelled correctly and resolves on a public network.'],
    };
  }
  // A hostname that only resolves to a private/local IP at request time (literal private addresses
  // are rejected earlier with exit 2). Blocked to prevent SSRF; only public hosts can be fetched.
  if (/blocked local or private target/.test(message)) {
    return {
      suggestions: [
        'The hostname resolves to a private or local address, which is blocked to prevent SSRF. Only public http(s) hosts can be fetched.',
      ],
      ref,
    };
  }
  return undefined;
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
