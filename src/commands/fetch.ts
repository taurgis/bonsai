import { Args, Flags } from '@oclif/core';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BaseCommand } from '../base-command.js';
import { writeArtifact, getArtifactPath, type LocatedArtifact } from '../lib/research/storage.js';
import { loadStoreRoots, type StoreRoots } from '../lib/research/store-roots.js';
import { writeArtifactSecurely } from '../lib/research/secure-write.js';
import { loadSummaryLevel, type StorageMode, type SummaryLevel } from '../lib/config/index.js';
import { evaluateFreshness, parseTtlToMs, checkMaxAgeExpired } from '../lib/research/freshness.js';
import { revalidateCache, createArtifactFromFetch } from '../lib/research/revalidate.js';
import { fetchStaticHtml, fetchText } from '../lib/research/fetcher.js';
import { fetchRenderedHtml } from '../lib/research/browser.js';
import { capturePage, type CaptureDeps } from '../lib/research/capture.js';
import { persistSectionArtifacts } from '../lib/research/docs/section-artifacts.js';
import { resolveResearchTarget } from '../lib/research/resolve-target.js';
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
    'Scrapes the specified URL, strips HTML boilerplate, converts the semantic payload into clean Markdown format, and caches the result locally using dynamic TTL rules.';

  static examples = [
    {
      description: 'Research a URL with detailed output, tagged with topic and tags',
      command:
        '<%= config.bin %> https://docs.nestjs.com/ --topic "Backend Frameworks" --tags "Node" --tags "NestJS" --format detailed --ttl 30d',
    },
    {
      description:
        'Research a volatile page with compressed output and short TTL, returned as JSON',
      command:
        '<%= config.bin %> https://news.ycombinator.com/ --format compressed --ttl 2h --json',
    },
  ];

  static args = {
    url: Args.string({
      required: true,
      description: 'The full HTTP/HTTPS URL of the web page to research.',
    }),
  };

  static flags = {
    topic: Flags.string({
      char: 't',
      description: 'The main category/topic of the research for metadata tagging.',
    }),
    tags: Flags.string({
      char: 'g',
      description: 'Taxonomic tags for this research (can be repeated).',
      multiple: true,
    }),
    format: Flags.option({
      char: 'f',
      description: 'Desired data density.',
      options: ['compressed', 'detailed'] as const,
      default: 'compressed',
    })(),
    tier: Flags.option({
      description: 'Freshness tier policy.',
      options: ['stable', 'standard', 'volatile'] as const,
      default: 'standard',
    })(),
    ttl: Flags.string({
      char: 'l',
      description: 'Predicted lifespan of the data (e.g., "2h", "7d", "3m").',
    }),
    'max-age': Flags.string({
      description: 'Maximum age of cache to accept (e.g., "1d", "30d").',
    }),
    force: Flags.boolean({
      description: 'Force a fresh fetch, ignoring any cached entries.',
      default: false,
    }),
    'dry-run': Flags.boolean({
      description: 'Perform validation and fetch without saving to local cache.',
      default: false,
    }),
    'allow-stale': Flags.boolean({
      description: 'Allow serving stale cache if the remote server is unreachable.',
      default: false,
    }),
    rendered: Flags.boolean({
      description: 'Force using a browser-rendered scraping path for dynamic pages.',
      default: false,
    }),
    storage: Flags.option({
      description:
        'Override where this result is cached (overrides configured default). Secret-bearing pages are always stored globally.',
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
    for (const [label, value] of [
      ['TTL', ttl],
      ['max-age', maxAge],
    ] as const) {
      if (!value) continue;
      try {
        parseTtlToMs(value);
      } catch (err) {
        this.error(`Invalid ${label}: ${(err as Error).message}`, { exit: 2 });
      }
    }
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
    return {
      cacheStatus: 'miss',
      freshnessState: 'stale_expired',
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

    let target: ReturnType<typeof resolveResearchTarget>;
    try {
      target = resolveResearchTarget({
        configDir: this.config.configDir,
        cwd: process.cwd(),
        dataDir: this.config.dataDir,
        flagOverride: this.flags.storage as StorageMode | undefined,
        lookup: !this.flags.force,
        url,
      });
    } catch (err) {
      this.error(`Invalid URL: ${(err as Error).message}`, { exit: 2 });
    }

    const { cacheKey, located, normalizedUrl, roots } = target;
    const summaryLevel = loadSummaryLevel(this.config.configDir, process.cwd());
    const tmpDir = dryRun ? mkdtempSync(join(tmpdir(), 'fnr-dry-run-')) : null;
    const currentTime = new Date();

    try {
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
    } finally {
      if (tmpDir) {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    }
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
    command.warn(`Serving stale content: revalidation failed: ${revalResult.error}`);
  } else {
    command.warn(`Serving stale content (exit 5): revalidation failed: ${revalResult.error}`);
    process.exitCode = 5;
  }
}
