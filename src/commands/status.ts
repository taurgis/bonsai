import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../base-command.js';
import { formatErrorForJson } from '../lib/envelope.js';
import { getArtifactPath } from '../lib/research/storage.js';
import {
  evaluateFreshness,
  checkMaxAgeExpired,
  durationFlagError,
} from '../lib/research/freshness.js';
import type { ResearchArtifact } from '../lib/research/schema.js';
import { colors } from '../lib/color.js';

type CacheStatus = 'hit' | 'miss' | 'stale';
// 'none' means no cache entry exists for the URL, so no freshness applies — distinct from
// 'stale_expired', which describes an entry that exists but has aged past its grace window.
type FreshnessStatus = 'fresh' | 'stale_grace' | 'stale_expired' | 'none';
type StatusAction = 'would_fetch' | 'would_revalidate' | 'would_return_cached';

interface StatusResult {
  action: StatusAction;
  freshness: FreshnessStatus;
  status: CacheStatus;
}

function resolveFreshness(
  cached: ResearchArtifact,
  currentTime: Date,
  ttl: string | undefined,
  maxAge: string | undefined
): FreshnessStatus {
  const isMaxAgeExpired = maxAge ? checkMaxAgeExpired(cached, currentTime, maxAge) : false;
  return isMaxAgeExpired
    ? 'stale_expired'
    : evaluateFreshness(cached.metadata, currentTime, ttl || cached.metadata.ttl);
}

function describeCacheStatus(
  cached: ResearchArtifact | null,
  currentTime: Date,
  ttl: string | undefined,
  maxAge: string | undefined
): StatusResult {
  if (!cached) {
    return { status: 'miss', freshness: 'none', action: 'would_fetch' };
  }

  const freshness = resolveFreshness(cached, currentTime, ttl, maxAge);
  return freshness === 'fresh'
    ? { status: 'hit', freshness, action: 'would_return_cached' }
    : { status: 'stale', freshness, action: 'would_revalidate' };
}

export default class ResearchStatus extends BaseCommand<typeof ResearchStatus> {
  static id = 'status';
  static summary = 'Check the cache status of a URL without fetching or writing.';
  static description =
    'Reports whether the URL is cached, its freshness state, and what action (fetch, revalidate, or cached return) the root fetch command would take.';

  static examples = [
    {
      description: 'check if a URL is already in the cache',
      command: '<%= config.bin %> <%= command.id %> https://example.com/docs',
    },
    {
      description: 'check status against a specific freshness tier and TTL',
      command:
        '<%= config.bin %> <%= command.id %> https://example.com/docs --tier volatile --ttl 2h',
    },
  ];

  static strict = false;

  static args = {
    url: Args.string({
      required: true,
      description: 'the URL to check',
    }),
  };

  static flags = {
    tier: Flags.option({
      description: 'freshness tier policy to evaluate against',
      options: ['stable', 'standard', 'volatile'] as const,
      default: 'standard',
    })(),
    ttl: Flags.string({
      char: 'l',
      description: 'custom TTL duration to evaluate against (e.g. "2h", "7d")',
    }),
    'max-age': Flags.string({
      description: 'maximum age of cache to accept (e.g. "1d", "30d")',
    }),
  };

  static stdoutIsPrimaryData = true;

  /** Enrich cache-miss envelopes with the same CACHE_MISS code and suggestions as inspect. */
  protected override toSuccessJson(data: unknown): Record<string, unknown> {
    const envelope = super.toSuccessJson(data);
    const list = Array.isArray(data) ? data : [data];
    const misses = list.filter((d) => d && d.status === 'miss');
    if (misses.length === 0) return envelope;

    const firstMiss = misses[0];
    const normalizedUrl = firstMiss.normalizedUrl ?? '';
    const suggestions = misses.map(
      (m) => `Fetch and cache it first: ${this.config.bin} ${m.normalizedUrl}`
    );
    const stderr = formatErrorForJson({
      message:
        `Cache miss for ${normalizedUrl}` +
        (misses.length > 1 ? ` and ${misses.length - 1} other URLs` : ''),
      code: 'CACHE_MISS',
      suggestions,
    });
    return { ...envelope, ok: false, exitCode: 1, stderr, code: 'CACHE_MISS', suggestions };
  }

  async run(): Promise<unknown> {
    const urls = this.parsedArgv;
    const { ttl, tier, 'max-age': maxAge } = this.flags;

    // Validate the duration flags up front so a malformed value reports the exact flag that is
    // wrong, rather than later surfacing as a misattributed parse failure.
    for (const msg of [durationFlagError('--ttl', ttl), durationFlagError('--max-age', maxAge)]) {
      if (msg) this.error(msg, { exit: 2, code: 'INVALID_DURATION' });
    }

    const results: any[] = [];
    let hasMiss = false;
    const currentTime = new Date();

    for (const url of urls) {
      const res = this.checkSingleStatus(url, currentTime, ttl, maxAge, urls.length > 1);
      if (res.status === 'miss') {
        hasMiss = true;
      }
      results.push(res);
    }

    if (hasMiss) {
      process.exitCode = 1;
    }

    return urls.length === 1 ? results[0] : results;
  }

  private checkSingleStatus(
    url: string,
    currentTime: Date,
    ttl: string | undefined,
    maxAge: string | undefined,
    showSeparator: boolean
  ): {
    cacheKey: string;
    cachePath: string;
    normalizedUrl: string;
    status: string;
    freshness: string;
    action: string;
  } {
    const target = this.resolveResearchTargetOrFail(url);
    const { cacheKey, located, normalizedUrl, roots } = target;
    const cached = located?.artifact ?? null;

    const result = describeCacheStatus(cached, currentTime, ttl, maxAge);
    const artifactPath = located?.path ?? getArtifactPath(roots.writeRoot, cacheKey);

    if (!this.jsonEnabled()) {
      const statusColorMap: Record<string, (t: string) => string> = {
        hit: colors.green,
        stale: colors.yellow,
        miss: colors.red,
      };
      const freshnessColorMap: Record<string, (t: string) => string> = {
        fresh: colors.green,
        stale_grace: colors.yellow,
        stale_expired: colors.red,
        none: colors.gray,
      };
      const actionColorMap: Record<string, (t: string) => string> = {
        would_return_cached: colors.green,
        would_revalidate: colors.yellow,
        would_fetch: colors.red,
      };

      const statusColor = statusColorMap[result.status] || ((t: string) => t);
      const freshnessColor = freshnessColorMap[result.freshness] || ((t: string) => t);
      const actionColor = actionColorMap[result.action] || ((t: string) => t);

      this.log(`${colors.cyan('URL:'.padEnd(25))} ${colors.bold(normalizedUrl)}`);
      this.log(`${colors.cyan('Cache Key:'.padEnd(25))} ${colors.bold(cacheKey)}`);
      this.log(`${colors.cyan('Cache Path:'.padEnd(25))} ${colors.gray(artifactPath)}`);
      this.log(`${colors.cyan('Status:'.padEnd(25))} ${statusColor(result.status)}`);
      this.log(`${colors.cyan('Freshness:'.padEnd(25))} ${freshnessColor(result.freshness)}`);
      this.log(`${colors.cyan('Action:'.padEnd(25))} ${actionColor(result.action)}`);
      if (showSeparator) {
        this.log('-'.repeat(40));
      }
    }

    if (result.status === 'miss' && !this.jsonEnabled()) {
      this.warn(`Cache miss — run: ${this.config.bin} ${normalizedUrl}`);
    }

    return {
      cacheKey,
      cachePath: artifactPath,
      normalizedUrl,
      status: result.status,
      freshness: result.freshness,
      action: result.action,
    };
  }
}
