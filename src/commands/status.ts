import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../base-command.js';
import { getArtifactPath } from '../lib/research/storage.js';
import {
  evaluateFreshness,
  checkMaxAgeExpired,
  durationFlagError,
} from '../lib/research/freshness.js';
import { resolveResearchTarget } from '../lib/research/resolve-target.js';
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

  static args = {
    url: Args.string({
      required: true,
      description: 'The URL to check.',
    }),
  };

  static flags = {
    tier: Flags.option({
      description: 'Freshness tier policy to evaluate against.',
      options: ['stable', 'standard', 'volatile'] as const,
      default: 'standard',
    })(),
    ttl: Flags.string({
      char: 'l',
      description: 'Custom TTL duration to evaluate against (e.g. "2h", "7d").',
    }),
    'max-age': Flags.string({
      description: 'Maximum age of cache to accept (e.g. "1d", "30d").',
    }),
  };

  static stdoutIsPrimaryData = true;

  async run(): Promise<unknown> {
    const { url } = this.args;
    const { ttl, tier, 'max-age': maxAge } = this.flags;

    // Validate the duration flags up front so a malformed value reports the exact flag that is
    // wrong, rather than later surfacing as a misattributed parse failure.
    for (const msg of [durationFlagError('--ttl', ttl), durationFlagError('--max-age', maxAge)]) {
      if (msg) this.error(msg, { exit: 2 });
    }

    let target: ReturnType<typeof resolveResearchTarget>;
    try {
      target = resolveResearchTarget({
        configDir: this.config.configDir,
        cwd: process.cwd(),
        dataDir: this.config.dataDir,
        url,
      });
    } catch (err) {
      this.error(`Invalid URL: ${(err as Error).message}`, { exit: 2 });
    }

    const { cacheKey, located, normalizedUrl, roots } = target;
    const cached = located?.artifact ?? null;
    const currentTime = new Date();

    // Both duration flags were validated above, so freshness resolution cannot throw on a parse error.
    const result = describeCacheStatus(cached, currentTime, ttl, maxAge);

    // On a hit, report where it actually lives; on a miss, where a fetch would write it.
    const artifactPath = located?.path ?? getArtifactPath(roots.writeRoot, cacheKey);

    if (!this.jsonEnabled()) {
      this.log(`URL: ${normalizedUrl}`);
      this.log(`Cache Key: ${cacheKey}`);
      this.log(`Cache Path: ${artifactPath}`);
      this.log(`Status: ${result.status}`);
      this.log(`Freshness: ${result.freshness}`);
      this.log(`Action: ${result.action}`);
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
