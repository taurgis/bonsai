import type { ResearchArtifactMetadata } from './schema.js';

export interface FreshnessPolicy {
  freshWindowMs: number;
  graceWindowMs: number;
}

/**
 * Parses simple TTL duration strings (e.g. '24h', '7d', '30d') to milliseconds.
 */
export function parseTtlToMs(ttl: string): number {
  const match = ttl.match(/^(\d+)([hdwmy])$/);
  if (!match) {
    throw new Error(`Invalid TTL format "${ttl}". Use formats like '24h', '7d', '30d'.`);
  }
  const val = parseInt(match[1] || '', 10);
  const unit = match[2] || '';
  const hour = 3600 * 1000;
  const day = 24 * hour;

  switch (unit) {
    case 'h':
      return val * hour;
    case 'd':
      return val * day;
    case 'w':
      return val * 7 * day;
    case 'm':
      return val * 30 * day;
    case 'y':
      return val * 365 * day;
    default:
      return 0;
  }
}

/**
 * Derives the active freshness policy based on the tier and optional TTL override.
 */
export function getPolicy(
  tier: 'stable' | 'standard' | 'volatile',
  ttlOverride?: string | null
): FreshnessPolicy {
  const day = 24 * 3600 * 1000;
  let freshWindowMs = 30 * day;
  let graceWindowMs = 14 * day;

  if (tier === 'stable') {
    freshWindowMs = 180 * day;
    graceWindowMs = 60 * day;
  } else if (tier === 'volatile') {
    freshWindowMs = 7 * day;
    graceWindowMs = 5 * day;
  }

  const activeTtl = ttlOverride;
  if (activeTtl) {
    freshWindowMs = parseTtlToMs(activeTtl);
    const defaultFresh = tier === 'stable' ? 180 * day : tier === 'volatile' ? 7 * day : 30 * day;
    const defaultGrace = tier === 'stable' ? 60 * day : tier === 'volatile' ? 5 * day : 14 * day;
    graceWindowMs = Math.floor(freshWindowMs * (defaultGrace / defaultFresh));
  }

  return { freshWindowMs, graceWindowMs };
}

/**
 * Evaluates the freshness status of a cached artifact.
 */
export function evaluateFreshness(
  meta: ResearchArtifactMetadata,
  currentTime: Date,
  ttlOverride?: string | null
): 'fresh' | 'stale_grace' | 'stale_expired' {
  const fetched = meta.fetched_at ? new Date(meta.fetched_at).getTime() : 0;
  const validated = meta.validated_at ? new Date(meta.validated_at).getTime() : 0;
  const baseTime = Math.max(fetched, validated);

  const { freshWindowMs, graceWindowMs } = getPolicy(meta.tier, ttlOverride || meta.ttl);
  const ageMs = currentTime.getTime() - baseTime;

  if (ageMs <= freshWindowMs) {
    return 'fresh';
  }
  if (ageMs <= freshWindowMs + graceWindowMs) {
    return 'stale_grace';
  }
  return 'stale_expired';
}

/**
 * Checks if the cached entry's age exceeds the specified max-age duration.
 */
export function checkMaxAgeExpired(
  cached: any,
  currentTime: Date,
  maxAge: string | undefined
): boolean {
  if (!maxAge) return false;
  const fetched = cached.metadata.fetched_at ? new Date(cached.metadata.fetched_at).getTime() : 0;
  const validated = cached.metadata.validated_at
    ? new Date(cached.metadata.validated_at).getTime()
    : 0;
  const baseTime = Math.max(fetched, validated);
  const ageMs = currentTime.getTime() - baseTime;
  return ageMs > parseTtlToMs(maxAge);
}
