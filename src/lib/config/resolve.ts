import type { ConfigValues, StorageMode, SummaryLevel } from './schema.js';
import { BUILT_IN_DEFAULTS, STORAGE_MODES, SUMMARY_LEVELS } from './schema.js';

/** Scoped env override, following oclif's `<BIN>_*` env-var convention for this CLI. */
export const STORAGE_ENV_VAR = 'BONSAI_STORAGE';
export const SUMMARY_ENV_VAR = 'BONSAI_SUMMARY';

/**
 * Warnings for Bonsai env overrides that are set but hold an unrecognized value. Such a value is
 * dropped during resolution (falling back to config/default), which would otherwise silently mask
 * a typo like `BONSAI_SUMMARY=agressive`. Callers surface these on stderr so the misconfiguration
 * is visible without breaking the run. Returns one message per offending variable, or empty.
 */
export function invalidEnvOverrideWarnings(env: Record<string, string | undefined>): string[] {
  const checks: ReadonlyArray<[name: string, valid: readonly string[]]> = [
    [STORAGE_ENV_VAR, STORAGE_MODES],
    [SUMMARY_ENV_VAR, SUMMARY_LEVELS],
  ];
  const warnings: string[] = [];
  for (const [name, valid] of checks) {
    // After trim, an empty/whitespace-only value is falsy and treated as "unset" (no warning),
    // matching parseEnv*; matching is case-sensitive, so a wrong-case value is invalid and warns.
    const raw = env[name]?.trim();
    if (raw && !valid.includes(raw)) {
      warnings.push(
        `Ignoring ${name}="${raw}": not one of ${valid.join(', ')}. ` +
          `Using the configured value or default instead.`
      );
    }
  }
  return warnings;
}

export function parseEnvStorage(env: Record<string, string | undefined>): StorageMode | undefined {
  const raw = env[STORAGE_ENV_VAR]?.trim();
  return (STORAGE_MODES as readonly string[]).includes(raw ?? '')
    ? (raw as StorageMode)
    : undefined;
}

export function parseEnvSummary(env: Record<string, string | undefined>): SummaryLevel | undefined {
  const raw = env[SUMMARY_ENV_VAR]?.trim();
  return (SUMMARY_LEVELS as readonly string[]).includes(raw ?? '')
    ? (raw as SummaryLevel)
    : undefined;
}

export interface ResolveStorageInput {
  flag?: StorageMode;
  env: Record<string, string | undefined>;
  projectConfig: Partial<ConfigValues>;
  userConfig: Partial<ConfigValues>;
}

/**
 * Resolve the effective storage mode in precedence order:
 * flag > env > project file > user file > built-in default.
 */
export function resolveStorageMode(input: ResolveStorageInput): StorageMode {
  return (
    input.flag ??
    parseEnvStorage(input.env) ??
    input.projectConfig.storage ??
    input.userConfig.storage ??
    BUILT_IN_DEFAULTS.storage
  );
}

export interface ResolveSummaryInput {
  flag?: SummaryLevel;
  env: Record<string, string | undefined>;
  projectConfig: Partial<ConfigValues>;
  userConfig: Partial<ConfigValues>;
}

/**
 * Resolve the effective summary level in precedence order:
 * flag > env > project file > user file > built-in default.
 */
export function resolveSummaryLevel(input: ResolveSummaryInput): SummaryLevel {
  return (
    input.flag ??
    parseEnvSummary(input.env) ??
    input.projectConfig.summary ??
    input.userConfig.summary ??
    BUILT_IN_DEFAULTS.summary
  );
}
