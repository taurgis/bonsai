import {
  writeUserConfig,
  writeProjectConfig,
  type ConfigKey,
  type ConfigValues,
} from './config/index.js';

/** Scope for config writes (`user` = XDG config dir; `project` = cwd `.bonsai`). */
export type ConfigWriteScope = 'user' | 'project';

/** Successful config persist outcome. */
export interface ConfigPersistResult {
  ok: true;
}

/** Failed config persist outcome with stable code and recovery tips. */
export interface ConfigPersistFailure {
  ok: false;
  code: 'CONFIG_DIR_UNAVAILABLE';
  message: string;
  suggestions: string[];
}

/**
 * Persist a config patch to user or project scope. Pure of oclif — callers map failures to
 * this.error(...). Shared by config set and unset so the write branch cannot drift.
 */
export function persistConfigPatch(opts: {
  scope: ConfigWriteScope;
  cwd: string;
  configDir: string | undefined;
  patch: Partial<ConfigValues>;
  /** Used in failure suggestions (set vs unset). */
  action: 'set' | 'unset';
  bin: string;
  key: ConfigKey;
}): ConfigPersistResult | ConfigPersistFailure {
  if (opts.scope === 'project') {
    writeProjectConfig(opts.cwd, opts.patch);
    return { ok: true };
  }
  if (!opts.configDir) {
    const verb = opts.action === 'set' ? 'write' : 'remove';
    const example =
      opts.action === 'set'
        ? `${opts.bin} config set ${opts.key} <value> --local`
        : `${opts.bin} config unset ${opts.key} --local`;
    return {
      ok: false,
      code: 'CONFIG_DIR_UNAVAILABLE',
      message: `Could not determine user config directory. Use --local to ${verb} project config.`,
      suggestions: [
        opts.action === 'set'
          ? `Write project config instead: ${example}`
          : `Remove project config instead: ${example}`,
      ],
    };
  }
  writeUserConfig(opts.configDir, opts.patch);
  return { ok: true };
}
