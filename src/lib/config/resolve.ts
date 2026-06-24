import type { ConfigValues, StorageMode } from './schema.js';
import { BUILT_IN_DEFAULTS, STORAGE_MODES } from './schema.js';

/** Scoped env override, following oclif's `<BIN>_*` env-var convention for this CLI. */
export const STORAGE_ENV_VAR = 'BONSAI_STORAGE';

export function parseEnvStorage(env: Record<string, string | undefined>): StorageMode | undefined {
  const raw = env[STORAGE_ENV_VAR]?.trim();
  return (STORAGE_MODES as readonly string[]).includes(raw ?? '')
    ? (raw as StorageMode)
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
