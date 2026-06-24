import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../../base-command.js';
import { normalizeUrl } from '../../lib/research/url.js';
import { deriveCacheKey } from '../../lib/research/cache-key.js';
import { findArtifact, getArtifactPath } from '../../lib/research/storage.js';
import { evaluateFreshness, checkMaxAgeExpired } from '../../lib/research/freshness.js';

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

    let normalizedUrl: string;
    let cacheKey: string;
    try {
      normalizedUrl = normalizeUrl(url);
      cacheKey = deriveCacheKey(normalizedUrl);
    } catch (err) {
      this.error(`Invalid URL: ${(err as Error).message}`, { exit: 2 });
    }

    const dataDir = this.config.dataDir;
    const cached = findArtifact(dataDir, cacheKey);
    const currentTime = new Date();

    let status: 'hit' | 'miss' | 'stale';
    let freshness: 'fresh' | 'stale_grace' | 'stale_expired';
    let action: 'would_fetch' | 'would_revalidate' | 'would_return_cached';

    if (!cached) {
      status = 'miss';
      freshness = 'stale_expired';
      action = 'would_fetch';
    } else {
      let isMaxAgeExpired = false;
      if (maxAge) {
        try {
          isMaxAgeExpired = checkMaxAgeExpired(cached, currentTime, maxAge);
        } catch (err) {
          this.error(`Invalid max-age: ${(err as Error).message}`, { exit: 2 });
        }
      }

      const freshnessState = isMaxAgeExpired
        ? 'stale_expired'
        : evaluateFreshness(cached.metadata, currentTime, ttl || cached.metadata.ttl);

      freshness = freshnessState;

      if (freshnessState === 'fresh') {
        status = 'hit';
        action = 'would_return_cached';
      } else {
        status = 'stale';
        action = 'would_revalidate';
      }
    }

    const artifactPath = getArtifactPath(dataDir, cacheKey);

    if (!this.requestedJson()) {
      this.log(`URL: ${normalizedUrl}`);
      this.log(`Cache Key: ${cacheKey}`);
      this.log(`Cache Path: ${artifactPath}`);
      this.log(`Status: ${status}`);
      this.log(`Freshness: ${freshness}`);
      this.log(`Action: ${action}`);
    }

    return {
      cacheKey,
      cachePath: artifactPath,
      status,
      freshness,
      action,
    };
  }
}
