import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../base-command.js';
import { getArtifactPath } from '../lib/research/storage.js';
import {
  evaluateFreshness,
  checkMaxAgeExpired,
  durationFlagError,
} from '../lib/research/freshness.js';
import type { ResearchArtifact } from '../lib/research/schema.js';

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

  async run(): Promise<unknown> {
    const { url } = this.args;
    const { ttl, tier, 'max-age': maxAge } = this.flags;

    // Validate the duration flags up front so a malformed value reports the exact flag that is
    // wrong, rather than later surfacing as a misattributed parse failure.
    for (const msg of [durationFlagError('--ttl', ttl), durationFlagError('--max-age', maxAge)]) {
      if (msg) this.error(msg, { exit: 2, code: 'INVALID_DURATION' });
    }

    const target = this.resolveResearchTargetOrFail(url);

    const { cacheKey, located, normalizedUrl, roots } = target;
    const cached = located?.artifact ?? null;
    const currentTime = new Date();

    // Both duration flags were validated above, so freshness resolution cannot throw on a parse error.
    const result = describeCacheStatus(cached, currentTime, ttl, maxAge);

    // On a hit, report where it actually lives; on a miss, where a fetch would write it.
    const artifactPath = located?.path ?? getArtifactPath(roots.writeRoot, cacheKey);

    if (!this.jsonEnabled()) {
      this.log(`${'URL:'.padEnd(25)} ${normalizedUrl}`);
      this.log(`${'Cache Key:'.padEnd(25)} ${cacheKey}`);
      this.log(`${'Cache Path:'.padEnd(25)} ${artifactPath}`);
      this.log(`${'Status:'.padEnd(25)} ${result.status}`);
      this.log(`${'Freshness:'.padEnd(25)} ${result.freshness}`);
      this.log(`${'Action:'.padEnd(25)} ${result.action}`);
    }

    // Align with inspect's CACHE_MISS contract: a miss is actionable, not a usage error. Exit 1
    // lets scripts branch on $? while JSON still returns the structured status payload. Unlike
    // inspect, we do not throw here — status must always return structured data even on a miss.
    if (result.status === 'miss') {
      this.warn(`Cache miss. Fetch and cache it first: ${this.config.bin} ${normalizedUrl}`);
      process.exitCode = 1;
    }

    return {
      cacheKey,
      cachePath: artifactPath,
      status: result.status,
      freshness: result.freshness,
      action: result.action,
    };
  }
}
