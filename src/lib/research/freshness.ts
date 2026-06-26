import type { ResearchArtifactMetadata } from './schema.js';

const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;

export interface FreshnessPolicy {
  freshWindowMs: number;
  graceWindowMs: number;
}

/**
 * Parses simple TTL duration strings to milliseconds. The unit `m` is months (not minutes); the
 * smallest unit is hours, since sub-hour cache lifespans are not meaningful for research artifacts.
 */
export function parseTtlToMs(ttl: string): number {
  const match = ttl.match(/^(\d+)([hdwmy])$/);
  if (!match) {
    // Deliberately does not start with "Invalid": durationFlagError wraps this as
    // "Invalid <flag>: <message>", and a leading "Invalid" here produced a "Invalid --ttl:
    // Invalid TTL format" stutter.
    throw new Error(
      `Duration "${ttl}" is not a valid format. Use a whole number plus a unit: ` +
        `h (hours), d (days), w (weeks), m (months), or y (years), e.g. '24h', '7d', '6m'.`
    );
  }
  const val = parseInt(match[1] || '', 10);
  const unit = match[2] || '';

  switch (unit) {
    case 'h':
      return val * HOUR_MS;
    case 'd':
      return val * DAY_MS;
    case 'w':
      return val * 7 * DAY_MS;
    case 'm':
      return val * 30 * DAY_MS;
    case 'y':
      return val * 365 * DAY_MS;
    default:
      return 0;
  }
}

/**
 * Validate a duration-valued flag. Returns an actionable error message that names the
 * offending flag when the value is malformed, or null when the flag is absent or valid.
 * Callers map a non-null message onto `this.error(msg, { exit: 2 })`, so every command
 * reports the same parse failure while naming the exact flag the user passed.
 */
export function durationFlagError(flag: string, value: string | undefined): string | null {
  if (!value) return null;
  try {
    parseTtlToMs(value);
    return null;
  } catch (err) {
    return `Invalid ${flag}: ${(err as Error).message}`;
  }
}

/**
 * Derives the active freshness policy based on the tier and optional TTL override.
 */
export function getPolicy(
  tier: 'stable' | 'standard' | 'volatile',
  ttlOverride?: string | null
): FreshnessPolicy {
  let freshWindowMs = 30 * DAY_MS;
  let graceWindowMs = 14 * DAY_MS;

  if (tier === 'stable') {
    freshWindowMs = 180 * DAY_MS;
    graceWindowMs = 60 * DAY_MS;
  } else if (tier === 'volatile') {
    freshWindowMs = 7 * DAY_MS;
    graceWindowMs = 5 * DAY_MS;
  }

  const activeTtl = ttlOverride;
  if (activeTtl) {
    freshWindowMs = parseTtlToMs(activeTtl);
    const defaultFresh =
      tier === 'stable' ? 180 * DAY_MS : tier === 'volatile' ? 7 * DAY_MS : 30 * DAY_MS;
    const defaultGrace =
      tier === 'stable' ? 60 * DAY_MS : tier === 'volatile' ? 5 * DAY_MS : 14 * DAY_MS;
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
