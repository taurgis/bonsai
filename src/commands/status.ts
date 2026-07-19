import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../base-command.js';
import { finalizeBatch, isBatchReadFailure, urlValidationErrorRow } from '../lib/batch.js';
import { getArtifactPath } from '../lib/research/storage.js';
import {
  durationFlagError,
  evaluateFreshnessWithMaxAge,
} from '../lib/research/freshness.js';
import type { ResearchArtifact } from '../lib/research/schema.js';
import type { StatusRow } from '../lib/cli-result-types.js';
import { CLI_FLAG_DESCRIPTIONS } from '../lib/cli-presentation.js';
import { batchSeparator, cacheMissHint, formatCacheTargetHeader } from '../lib/cache-view.js';
import { colors } from '../lib/color.js';

type CacheStatus = StatusRow['status'];
// 'none' means no cache entry exists for the URL, so no freshness applies — distinct from
// 'stale_expired', which describes an entry that exists but has aged past its grace window.
type FreshnessStatus = StatusRow['freshness'];
type StatusAction = StatusRow['action'];

interface StatusResult {
  action: StatusAction;
  freshness: FreshnessStatus;
  status: CacheStatus;
}

type Tier = 'stable' | 'standard' | 'volatile';

function resolveFreshness(
  cached: ResearchArtifact,
  currentTime: Date,
  ttl: string | undefined,
  maxAge: string | undefined,
  tier: Tier | undefined
): FreshnessStatus {
  return evaluateFreshnessWithMaxAge(cached, currentTime, { ttl, maxAge, tier });
}

function describeCacheStatus(
  cached: ResearchArtifact | null,
  currentTime: Date,
  ttl: string | undefined,
  maxAge: string | undefined,
  tier: Tier | undefined
): StatusResult {
  if (!cached) {
    return { status: 'miss', freshness: 'none', action: 'would_fetch' };
  }

  const freshness = resolveFreshness(cached, currentTime, ttl, maxAge, tier);
  return freshness === 'fresh'
    ? { status: 'hit', freshness, action: 'would_return_cached' }
    : { status: 'stale', freshness, action: 'would_revalidate' };
}

export default class ResearchStatus extends BaseCommand<typeof ResearchStatus> {
  static id = 'status';
  static summary = 'Check cache status without fetching or writing';
  static description =
    'Report cache hit/miss state, freshness, and the action the URL shorthand would take.';

  static examples = [
    {
      description: 'check whether a URL is cached',
      command: '<%= config.bin %> <%= command.id %> https://example.com/docs',
    },
    {
      description: 'evaluate status with a specific tier and TTL',
      command:
        '<%= config.bin %> <%= command.id %> https://example.com/docs --tier volatile --ttl 2h',
    },
  ];

  static strict = false;

  static args = {
    url: Args.string({
      required: true,
      description: 'URL to check',
    }),
  };

  static flags = {
    // No default: omitting --tier evaluates against the artifact's stored tier. A default of
    // `standard` would silently re-grade stable/volatile entries and lie about planned action.
    tier: Flags.option({
      description: CLI_FLAG_DESCRIPTIONS.statusFreshnessTierPolicy,
      options: ['stable', 'standard', 'volatile'] as const,
    })(),
    ttl: Flags.string({
      char: 'l',
      description: CLI_FLAG_DESCRIPTIONS.statusTtl,
    }),
    'max-age': Flags.string({
      description: CLI_FLAG_DESCRIPTIONS.maxAge,
    }),
  };

  static stdoutIsPrimaryData = true;

  protected override toSuccessJson(data: unknown): Record<string, unknown> {
    return this.batchReadSuccessJson(data);
  }

  async run(): Promise<unknown> {
    const urls = this.parsedArgv;
    const { ttl, tier, 'max-age': maxAge } = this.flags;

    // Validate the duration flags up front so a malformed value reports the exact flag that is
    // wrong, rather than later surfacing as a misattributed parse failure.
    for (const msg of [durationFlagError('--ttl', ttl), durationFlagError('--max-age', maxAge)]) {
      if (msg) this.error(msg, { exit: 2, code: 'INVALID_DURATION' });
    }

    const currentTime = new Date();
    const results = this.mapUrlsAllowingBatchErrors(
      urls,
      (url) => this.checkSingleStatus(url, currentTime, { ttl, maxAge, tier }),
      urlValidationErrorRow
    );
    return finalizeBatch(results, isBatchReadFailure);
  }

  private checkSingleStatus(
    url: string,
    currentTime: Date,
    policy: { ttl: string | undefined; maxAge: string | undefined; tier: Tier | undefined }
  ): StatusRow {
    const target = this.resolveResearchTargetOrFail(url);
    const { cacheKey, located, normalizedUrl, roots } = target;
    const cached = located?.artifact ?? null;

    const result = describeCacheStatus(cached, currentTime, policy.ttl, policy.maxAge, policy.tier);
    const artifactPath = located?.path ?? getArtifactPath(roots.writeRoot, cacheKey);

    if (!this.jsonEnabled()) {
      this.logStatusTable(target, artifactPath, result);
      if (result.status === 'miss') {
        this.warn(cacheMissHint(this.config.bin, normalizedUrl));
      }
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

  private logStatusTable(
    target: { normalizedUrl: string; cacheKey: string; roots: { writeRoot: string } },
    artifactPath: string,
    result: StatusResult
  ): void {
    const colorOf = (map: Record<string, (t: string) => string>, key: string) =>
      map[key] ?? ((t: string) => t);
    const statusColor = colorOf(
      { hit: colors.green, stale: colors.yellow, miss: colors.red },
      result.status
    );
    const freshnessColor = colorOf(
      {
        fresh: colors.green,
        stale_grace: colors.yellow,
        stale_expired: colors.red,
        none: colors.gray,
      },
      result.freshness
    );
    const actionColor = colorOf(
      {
        would_return_cached: colors.green,
        would_revalidate: colors.yellow,
        would_fetch: colors.red,
      },
      result.action
    );

    for (const line of formatCacheTargetHeader(
      target,
      [
        ['Status', statusColor(result.status)],
        ['Freshness', freshnessColor(result.freshness)],
        ['Action', actionColor(result.action)],
      ],
      artifactPath
    )) {
      this.log(line);
    }
    const sep = batchSeparator(this.parsedArgv.length > 1);
    if (sep) this.log(sep);
  }
}
