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
  keyValuesHint,
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
import {
  parseEnvStorage,
  parseEnvSummary,
  resolveStorageMode,
  resolveSummaryLevel,
} from './resolve.js';
import {
  ALL_KEYS,
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
 * or the fully merged result (`effective`). Shared by write paths and callers that only need the
 * raw scoped blob (not configured metadata).
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
 * Whether any non-default layer pins `key`. For `--global`/`--local`, that is the file itself.
 * For effective, project file, user file, or a valid BONSAI_* env override counts — so a bare
 * default never reports `configured: true` just because `effectiveConfig` always fills values.
 */
function isKeyConfigured(
  key: ConfigKey,
  scope: ConfigScope,
  project: ConfigValues,
  user: ConfigValues,
  env: Record<string, string | undefined>
): boolean {
  if (scope === 'global') return key in user;
  if (scope === 'local') return key in project;
  if (key in project || key in user) return true;
  if (key === 'storage') return parseEnvStorage(env) !== undefined;
  if (key === 'summary') return parseEnvSummary(env) !== undefined;
  return false;
}

function buildEntry(
  key: ConfigKey,
  scope: ConfigScope,
  project: ConfigValues,
  user: ConfigValues,
  env: Record<string, string | undefined>
): ConfigEntry {
  const configured = isKeyConfigured(key, scope, project, user, env);
  if (key === 'storage') {
    const value =
      scope === 'effective'
        ? resolveStorageMode({ env, projectConfig: project, userConfig: user })
        : ((scope === 'global' ? user : project).storage ?? BUILT_IN_DEFAULTS.storage);
    return { key, value, configured };
  }
  const value =
    scope === 'effective'
      ? resolveSummaryLevel({ env, projectConfig: project, userConfig: user })
      : ((scope === 'global' ? user : project).summary ?? BUILT_IN_DEFAULTS.summary);
  return { key, value, configured };
}

/** Resolve a single key; same semantics as {@link resolveConfigEntries}. */
export function resolveConfigEntry(
  key: ConfigKey,
  scope: ConfigScope,
  configDir: string | undefined,
  cwd: string,
  env: Record<string, string | undefined> = process.env
): ConfigEntry {
  return buildEntry(key, scope, readProjectConfig(cwd), readUserConfig(configDir), env);
}

/**
 * Resolve every config key for a scope. Unset keys fall back to the built-in default while
 * `configured: false` tells agents the value is not pinned beyond that default.
 */
export function resolveConfigEntries(
  scope: ConfigScope,
  configDir: string | undefined,
  cwd: string,
  env: Record<string, string | undefined> = process.env
): ConfigEntry[] {
  const project = readProjectConfig(cwd);
  const user = readUserConfig(configDir);
  return ALL_KEYS.map((key) => buildEntry(key, scope, project, user, env));
}

/**
 * Human display for a resolved entry. Effective scope always has a usable value, so the
 * "(not configured)" suffix is reserved for `--global`/`--local` reads where absence matters.
 */
export function formatConfigEntry(entry: ConfigEntry, scope: ConfigScope = 'local'): string {
  const formatted = KEY_META[entry.key].format(entry.value);
  if (scope === 'effective' || entry.configured) return formatted;
  return `${formatted} (not configured)`;
}
