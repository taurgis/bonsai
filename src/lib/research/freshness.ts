import type { ResearchArtifactMetadata } from './schema.js';

const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Calendar multipliers used when parsing duration units (`w`/`m`/`y`). */
const DAYS_PER_WEEK = 7;
const DAYS_PER_MONTH = 30;
const DAYS_PER_YEAR = 365;

/** Default freshness windows by tier (days). Grace is the additional serve-stale window. */
const STANDARD_FRESH_DAYS = 30;
const STANDARD_GRACE_DAYS = 14;
const STABLE_FRESH_DAYS = 180;
const STABLE_GRACE_DAYS = 60;
const VOLATILE_FRESH_DAYS = 7;
const VOLATILE_GRACE_DAYS = 5;

/** Shared unit hint for parse failures and empty-duration rejection. */
const DURATION_FORMAT_HINT =
  `Use a whole number plus a unit: ` +
  `h (hours), d (days), w (weeks), m (months), or y (years), e.g. '2h', '7d', '6m'.`;

/** Fresh and grace windows derived from a tier and optional TTL override. */
export interface FreshnessPolicy {
  freshWindowMs: number;
  graceWindowMs: number;
}

/**
 * Parses a TTL/duration string into milliseconds.
 * The unit `m` means months (not minutes); the smallest unit is hours.
 *
 * @param ttl - Whole number plus unit (`h`/`d`/`w`/`m`/`y`).
 * @returns Duration in milliseconds.
 * @throws {Error} When the format is invalid or the duration is zero.
 */
export function parseTtlToMs(ttl: string): number {
  const match = ttl.match(/^(\d+)([hdwmy])$/);
  if (!match) {
    // Deliberately does not start with "Invalid": durationFlagError wraps this as
    // "Invalid <flag>: <message>", and a leading "Invalid" here produced a "Invalid --ttl:
    // Invalid TTL format" stutter.
    throw new Error(`Duration "${ttl}" is not a valid format. ${DURATION_FORMAT_HINT}`);
  }
  const amount = parseInt(match[1] || '', 10);
  const unit = match[2] || '';

  // Zero-length durations would match every entry (age >= 0) and turn prune filters into a wipe.
  if (amount === 0) {
    throw new Error(`Duration "${ttl}" must be greater than zero.`);
  }

  switch (unit) {
    case 'h':
      return amount * HOUR_MS;
    case 'd':
      return amount * DAY_MS;
    case 'w':
      return amount * DAYS_PER_WEEK * DAY_MS;
    case 'm':
      return amount * DAYS_PER_MONTH * DAY_MS;
    case 'y':
      return amount * DAYS_PER_YEAR * DAY_MS;
    default:
      return 0;
  }
}

/**
 * Validate a duration-valued flag.
 *
 * @param flag - Flag token for the error message (e.g. `--ttl`).
 * @param value - Raw flag value, or `undefined` when omitted.
 * @returns Actionable error message, or `null` when absent/valid.
 */
export function durationFlagError(flag: string, value: string | undefined): string | null {
  // Absent is fine; empty/whitespace is almost always a shell-quoting mistake and must not
  // silently mean "no override" (unlike a truly omitted flag).
  if (value === undefined) return null;
  if (value.trim() === '') {
    return `Invalid ${flag}: Duration must not be empty. ${DURATION_FORMAT_HINT}`;
  }
  try {
    parseTtlToMs(value);
    return null;
  } catch (err) {
    return `Invalid ${flag}: ${(err as Error).message}`;
  }
}

/**
 * Derives the active freshness policy from a tier and optional TTL override.
 * When a TTL override is set, grace scales proportionally to the tier's default ratio.
 *
 * @param tier - Freshness tier (`stable` / `standard` / `volatile`).
 * @param ttlOverride - Optional TTL string replacing the tier's fresh window.
 * @returns Fresh and grace windows in milliseconds.
 */
export function resolveFreshnessPolicy(
  tier: 'stable' | 'standard' | 'volatile',
  ttlOverride?: string | null
): FreshnessPolicy {
  let freshWindowMs = STANDARD_FRESH_DAYS * DAY_MS;
  let graceWindowMs = STANDARD_GRACE_DAYS * DAY_MS;

  if (tier === 'stable') {
    freshWindowMs = STABLE_FRESH_DAYS * DAY_MS;
    graceWindowMs = STABLE_GRACE_DAYS * DAY_MS;
  } else if (tier === 'volatile') {
    freshWindowMs = VOLATILE_FRESH_DAYS * DAY_MS;
    graceWindowMs = VOLATILE_GRACE_DAYS * DAY_MS;
  }

  if (ttlOverride) {
    const defaultFresh = freshWindowMs;
    const defaultGrace = graceWindowMs;
    freshWindowMs = parseTtlToMs(ttlOverride);
    graceWindowMs = Math.floor(freshWindowMs * (defaultGrace / defaultFresh));
  }

  return { freshWindowMs, graceWindowMs };
}

/**
 * Evaluates the freshness status of a cached artifact.
 * `ttlOverride` / `tierOverride` let status (and similar read-only checks) evaluate "what if"
 * policies without mutating the stored metadata. When omitted, the artifact's own tier/TTL win.
 *
 * @param meta - Artifact metadata providing timestamps, tier, and stored TTL.
 * @param currentTime - Clock used for age calculation.
 * @param ttlOverride - Optional TTL replacing the stored TTL for this evaluation.
 * @param tierOverride - Optional tier replacing the stored tier for this evaluation.
 * @returns `fresh`, `stale_grace`, or `stale_expired`.
 */
export function evaluateFreshness(
  meta: ResearchArtifactMetadata,
  currentTime: Date,
  ttlOverride?: string | null,
  tierOverride?: 'stable' | 'standard' | 'volatile' | null
): 'fresh' | 'stale_grace' | 'stale_expired' {
  const fetched = meta.fetched_at ? new Date(meta.fetched_at).getTime() : 0;
  const validated = meta.validated_at ? new Date(meta.validated_at).getTime() : 0;
  const baseTime = Math.max(fetched, validated);

  const { freshWindowMs, graceWindowMs } = resolveFreshnessPolicy(
    tierOverride ?? meta.tier,
    ttlOverride || meta.ttl
  );
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
 * Checks whether the cached entry's age exceeds the specified max-age duration.
 *
 * @param cached - Artifact (or metadata bag) with fetch/validate timestamps.
 * @param currentTime - Clock used for age calculation.
 * @param maxAge - Duration string, or `undefined` to skip the check.
 * @returns `true` when max-age is set and exceeded.
 */
export function checkMaxAgeExpired(
  cached: { metadata: Pick<ResearchArtifactMetadata, 'fetched_at' | 'validated_at'> },
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

/**
 * Freshness for a cached artifact, applying `--max-age` before the tier/TTL windows.
 *
 * @param cached - Artifact with full metadata.
 * @param currentTime - Clock used for age calculation.
 * @param options.ttl - Optional TTL override.
 * @param options.maxAge - Optional max-age duration; when exceeded returns `stale_expired`.
 * @param options.tier - Optional tier override.
 * @returns `fresh`, `stale_grace`, or `stale_expired`.
 */
export function evaluateFreshnessWithMaxAge(
  cached: { metadata: ResearchArtifactMetadata },
  currentTime: Date,
  options: {
    ttl?: string | null;
    maxAge?: string;
    tier?: 'stable' | 'standard' | 'volatile' | null;
  } = {}
): 'fresh' | 'stale_grace' | 'stale_expired' {
  if (checkMaxAgeExpired(cached, currentTime, options.maxAge)) {
    return 'stale_expired';
  }
  return evaluateFreshness(cached.metadata, currentTime, options.ttl, options.tier);
}
