import { Args, Flags } from '@oclif/core';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BaseCommand } from '../base-command.js';
import { normalizeUrl } from '../lib/research/url.js';
import { deriveCacheKey } from '../lib/research/cache-key.js';
import { findArtifact, writeArtifact, getArtifactPath } from '../lib/research/storage.js';
import { evaluateFreshness, parseTtlToMs, checkMaxAgeExpired } from '../lib/research/freshness.js';
import { revalidateCache, createArtifactFromFetch } from '../lib/research/revalidate.js';
import { fetchStaticHtml } from '../lib/research/fetcher.js';
import { extractHtmlContent } from '../lib/research/extract.js';
import { fetchRenderedHtml } from '../lib/research/browser.js';
import { detectSite } from '../sites/index.js';
import type { SiteFetchResult } from '../sites/types.js';

export default class Research extends BaseCommand<typeof Research> {
  static id = 'research';
  static summary = 'An advanced, locally cached web research tool optimized for LLM ingestion.';
  static description =
    'Scrapes the specified URL, strips HTML boilerplate, converts the semantic payload into clean Markdown format, and caches the result locally using dynamic TTL rules.';

  static examples = [
    {
      description: 'Research a URL with detailed output, tagged with topic and tags',
      command:
        '<%= config.bin %> research https://docs.nestjs.com/ --topic "Backend Frameworks" --tags "Node" --tags "NestJS" --format detailed --ttl 30d',
    },
    {
      description:
        'Research a volatile page with compressed output and short TTL, returned as JSON',
      command:
        '<%= config.bin %> research https://news.ycombinator.com/ --format compressed --ttl 2h --json',
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
  };

  static stdoutIsPrimaryData = true;

  async init(): Promise<void> {
    await super.init();
    const { args, flags } = await this.parse(Research);
    this.args = args;
    this.flags = flags;
  }

  private async executeCacheHit(
    cached: any,
    targetDir: string,
    currentTime: Date
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
    targetDir: string,
    currentTime: Date,
    cacheKey: string
  ): Promise<any> {
    const { topic, tags, tier, ttl, rendered } = this.flags;

    const siteModule = detectSite(normalizedUrl);
    const useRendered = rendered || Boolean(siteModule?.defaults?.rendered);

    let fetchResult: SiteFetchResult['fetchResult'];
    let extraction: SiteFetchResult['extraction'];
    if (siteModule?.fetchPage) {
      ({ fetchResult, extraction } = await siteModule.fetchPage(normalizedUrl));
    } else {
      fetchResult = useRendered
        ? await fetchRenderedHtml(normalizedUrl)
        : await fetchStaticHtml(normalizedUrl);
      extraction = extractHtmlContent(fetchResult.content, fetchResult.finalUrl);
    }

    const artifact = createArtifactFromFetch(
      normalizedUrl,
      normalizedUrl,
      cacheKey,
      fetchResult,
      extraction,
      tier,
      ttl || null,
      currentTime
    );

    artifact.metadata.topic = topic || null;
    artifact.metadata.tags = tags || [];
    artifact.metadata.site_module_id = siteModule?.id ?? null;
    if (useRendered) {
      artifact.metadata.capture_method = 'browser_fallback';
    }

    writeArtifact(targetDir, cacheKey, artifact);
    return artifact;
  }

  private buildResultData(
    url: string,
    normalizedUrl: string,
    cacheKey: string,
    targetDir: string,
    dataDir: string,
    cacheStatus: any,
    freshnessState: any,
    format: any,
    artifact: any,
    content: string,
    dryRun: boolean
  ): any {
    return {
      schemaVersion: 1,
      command: 'research',
      cache: {
        key: cacheKey,
        status: cacheStatus,
        freshness: freshnessState,
        path: getArtifactPath(dryRun ? targetDir : dataDir, cacheKey),
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
      format,
      tokenEstimate:
        format === 'compressed'
          ? artifact.metadata.token_estimate.compressed
          : artifact.metadata.token_estimate.detailed,
      content,
    };
  }

  async execute(): Promise<unknown> {
    const { url } = this.args;
    const { format, ttl, 'max-age': maxAge, force, 'dry-run': dryRun } = this.flags;

    if (ttl)
      try {
        parseTtlToMs(ttl);
      } catch (err) {
        this.error(`Invalid TTL: ${(err as Error).message}`, { exit: 2 });
      }
    if (maxAge)
      try {
        parseTtlToMs(maxAge);
      } catch (err) {
        this.error(`Invalid max-age: ${(err as Error).message}`, { exit: 2 });
      }

    let normalizedUrl: string;
    let cacheKey: string;
    try {
      normalizedUrl = normalizeUrl(url);
      cacheKey = deriveCacheKey(normalizedUrl);
    } catch (err) {
      this.error(`Invalid URL: ${(err as Error).message}`, { exit: 2 });
    }

    const dataDir = this.config.dataDir;
    const targetDir = dryRun ? mkdtempSync(join(tmpdir(), 'fnr-dry-run-')) : dataDir;
    const currentTime = new Date();

    try {
      const cached = findArtifact(dataDir, cacheKey);
      let cacheStatus: any = 'miss';
      let freshnessState: any = 'stale_expired';
      let artifact: any;

      if (cached && !force) {
        const res = await this.executeCacheHit(cached, targetDir, currentTime);
        cacheStatus = res.cacheStatus;
        freshnessState = res.freshnessState;
        artifact = res.artifact;
      } else {
        artifact = await this.executeCacheMiss(normalizedUrl, targetDir, currentTime, cacheKey);
      }

      const content = format === 'compressed' ? artifact.compressed : artifact.detailed;
      const resultData = this.buildResultData(
        url,
        normalizedUrl,
        cacheKey,
        targetDir,
        dataDir,
        cacheStatus,
        freshnessState,
        format,
        artifact,
        content,
        Boolean(dryRun)
      );

      if (!this.requestedJson()) {
        this.log(content);
      }
      return resultData;
    } finally {
      if (dryRun) {
        rmSync(targetDir, { recursive: true, force: true });
      }
    }
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
