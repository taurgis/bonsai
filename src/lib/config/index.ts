export {
  type ConfigValues,
  type ResolvedConfig,
  type ConfigKey,
  type StorageMode,
  type SummaryLevel,
  type KeyMeta,
  SCHEMA_VERSION,
  STORAGE_MODES,
  SUMMARY_LEVELS,
  ALL_KEYS,
  BUILT_IN_DEFAULTS,
  KEY_META,
  isKnownKey,
  suggestKey,
  validKeysHint,
} from './schema.js';

export {
  readUserConfig,
  readProjectConfig,
  writeUserConfig,
  writeProjectConfig,
  USER_CONFIG_FILENAME,
  PROJECT_CONFIG_FILENAME,
} from './io.js';

export {
  resolveStorageMode,
  resolveSummaryLevel,
  resolveReadOnly,
  parseEnvStorage,
  parseEnvSummary,
  parseEnvBoolean,
  invalidEnvOverrideWarnings,
  STORAGE_ENV_VAR,
  SUMMARY_ENV_VAR,
  READ_ONLY_ENV_VAR,
  PLAN_MODE_ENV_VAR,
  type ResolveStorageInput,
  type ResolveSummaryInput,
  type ResolveReadOnlyInput,
} from './resolve.js';

import { readUserConfig, readProjectConfig } from './io.js';
import { resolveStorageMode, resolveSummaryLevel } from './resolve.js';
import {
  BUILT_IN_DEFAULTS,
  KEY_META,
  type ConfigKey,
  type ConfigValues,
  type ResolvedConfig,
  type StorageMode,
  type SummaryLevel,
} from './schema.js';

/**
 * Read both config files once and resolve the effective storage mode.
 * `flag` (a per-invocation `--storage` override) wins over everything else.
 */
export function loadStorageMode(
  configDir: string | undefined,
  cwd: string,
  flag?: StorageMode,
  env: Record<string, string | undefined> = process.env
): StorageMode {
  return resolveStorageMode({
    flag,
    env,
    projectConfig: readProjectConfig(cwd),
    userConfig: readUserConfig(configDir),
  });
}

/**
 * Read both config files once and resolve the effective summary level.
 * `flag` (a per-invocation override) wins over everything else.
 */
export function loadSummaryLevel(
  configDir: string | undefined,
  cwd: string,
  flag?: SummaryLevel,
  env: Record<string, string | undefined> = process.env
): SummaryLevel {
  return resolveSummaryLevel({
    flag,
    env,
    projectConfig: readProjectConfig(cwd),
    userConfig: readUserConfig(configDir),
  });
}

/** The resolved value of every config key, factoring file + env layers. Extend as keys are added. */
export function effectiveConfig(configDir: string | undefined, cwd: string): ResolvedConfig {
  return {
    storage: loadStorageMode(configDir, cwd),
    summary: loadSummaryLevel(configDir, cwd),
  };
}

export type ConfigScope = 'global' | 'local' | 'effective';

/**
 * The config values for a requested scope: the user file (`global`), the project file (`local`),
 * or the fully merged result (`effective`). Shared by `config get` and `config list` so the
 * scope-selection lives in one place.
 */
export function readScopedConfig(
  scope: ConfigScope,
  configDir: string | undefined,
  cwd: string
): Partial<ConfigValues> {
  if (scope === 'global') return readUserConfig(configDir);
  if (scope === 'local') return readProjectConfig(cwd);
  return effectiveConfig(configDir, cwd);
}

/** One config key resolved against a scope: effective value + whether that scope set it. */
export interface ConfigEntry {
  key: ConfigKey;
  value: ResolvedConfig[ConfigKey];
  configured: boolean;
}

/**
 * Resolve a single key from a scoped read. Unset keys fall back to the built-in default while
 * `configured: false` tells agents the value is not pinned in that scope.
 */
export function resolveConfigEntry(key: ConfigKey, scoped: Partial<ConfigValues>): ConfigEntry {
  const raw = scoped[key];
  return {
    key,
    value: (raw !== undefined ? raw : BUILT_IN_DEFAULTS[key]) as ResolvedConfig[ConfigKey],
    configured: raw !== undefined,
  };
}

/** Human display for a resolved entry (`value` or `value (not configured)`). */
export function formatConfigEntry(entry: ConfigEntry): string {
  const formatted = KEY_META[entry.key].format(entry.value);
  return entry.configured ? formatted : `${formatted} (not configured)`;
}
