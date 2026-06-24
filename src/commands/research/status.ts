import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../../base-command.js';
import { getArtifactPath } from '../../lib/research/storage.js';
import { evaluateFreshness, checkMaxAgeExpired } from '../../lib/research/freshness.js';
import { resolveResearchTarget } from '../../lib/research/resolve-target.js';
import type { ResearchArtifact } from '../../lib/research/schema.js';

type CacheStatus = 'hit' | 'miss' | 'stale';
type FreshnessStatus = 'fresh' | 'stale_grace' | 'stale_expired';
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
    return { status: 'miss', freshness: 'stale_expired', action: 'would_fetch' };
  }

  const freshness = resolveFreshness(cached, currentTime, ttl, maxAge);
  return freshness === 'fresh'
    ? { status: 'hit', freshness, action: 'would_return_cached' }
    : { status: 'stale', freshness, action: 'would_revalidate' };
}

export default class ResearchStatus extends BaseCommand<typeof ResearchStatus> {
  static id = 'research status';
  static summary = 'Check the cache status of a URL without fetching or writing.';
  static description =
    'Reports whether the URL is cached, its freshness state, and what action (fetch, revalidate, or cached return) the research command would take.';

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

  async init(): Promise<void> {
    await super.init();
    const { args, flags } = await this.parse(ResearchStatus);
    this.args = args;
    this.flags = flags;
  }

  async execute(): Promise<unknown> {
    const { url } = this.args;
    const { ttl, tier, 'max-age': maxAge } = this.flags;

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

    let result: StatusResult;
    try {
      result = describeCacheStatus(cached, currentTime, ttl, maxAge);
    } catch (err) {
      this.error(`Invalid max-age: ${(err as Error).message}`, { exit: 2 });
    }

    // On a hit, report where it actually lives; on a miss, where a fetch would write it.
    const artifactPath = located?.path ?? getArtifactPath(roots.writeRoot, cacheKey);

    if (!this.requestedJson()) {
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
