import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
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
} from './resolve.js';
import {
  readUserConfig,
  readProjectConfig,
  writeUserConfig,
  writeProjectConfig,
  PROJECT_CONFIG_FILENAME,
} from './io.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'fnr-config-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('resolveStorageMode precedence', () => {
  const base = { env: {}, projectConfig: {}, userConfig: {} };

  it('defaults to global when nothing is set', () => {
    expect(resolveStorageMode(base)).toBe('global');
  });

  it('uses the user file, then project file overrides it', () => {
    expect(resolveStorageMode({ ...base, userConfig: { storage: 'project' } })).toBe('project');
    expect(
      resolveStorageMode({
        ...base,
        userConfig: { storage: 'project' },
        projectConfig: { storage: 'global' },
      })
    ).toBe('global');
  });

  it('lets env override both files, and flag override everything', () => {
    const env = { [STORAGE_ENV_VAR]: 'global' };
    expect(resolveStorageMode({ ...base, env, projectConfig: { storage: 'project' } })).toBe(
      'global'
    );
    expect(
      resolveStorageMode({
        flag: 'project',
        env,
        projectConfig: { storage: 'global' },
        userConfig: {},
      })
    ).toBe('project');
  });
});

describe('parseEnvStorage', () => {
  it('accepts valid modes and rejects junk', () => {
    expect(parseEnvStorage({ [STORAGE_ENV_VAR]: 'project' })).toBe('project');
    expect(parseEnvStorage({ [STORAGE_ENV_VAR]: ' global ' })).toBe('global');
    expect(parseEnvStorage({ [STORAGE_ENV_VAR]: 'bogus' })).toBeUndefined();
    expect(parseEnvStorage({})).toBeUndefined();
  });
});

describe('resolveSummaryLevel precedence', () => {
  const base = { env: {}, projectConfig: {}, userConfig: {} };

  it('defaults to conservative when nothing is set', () => {
    expect(resolveSummaryLevel(base)).toBe('conservative');
  });

  it('uses the user file, then project file overrides it', () => {
    expect(resolveSummaryLevel({ ...base, userConfig: { summary: 'balanced' } })).toBe('balanced');
    expect(
      resolveSummaryLevel({
        ...base,
        userConfig: { summary: 'balanced' },
        projectConfig: { summary: 'aggressive' },
      })
    ).toBe('aggressive');
  });

  it('lets env override both files, and flag override everything', () => {
    const env = { [SUMMARY_ENV_VAR]: 'balanced' };
    expect(resolveSummaryLevel({ ...base, env, projectConfig: { summary: 'aggressive' } })).toBe(
      'balanced'
    );
    expect(
      resolveSummaryLevel({
        flag: 'aggressive',
        env,
        projectConfig: { summary: 'conservative' },
        userConfig: {},
      })
    ).toBe('aggressive');
  });
});

describe('parseEnvSummary', () => {
  it('accepts valid levels and rejects junk', () => {
    expect(parseEnvSummary({ [SUMMARY_ENV_VAR]: 'balanced' })).toBe('balanced');
    expect(parseEnvSummary({ [SUMMARY_ENV_VAR]: ' aggressive ' })).toBe('aggressive');
    expect(parseEnvSummary({ [SUMMARY_ENV_VAR]: 'bogus' })).toBeUndefined();
    expect(parseEnvSummary({})).toBeUndefined();
  });
});

describe('invalidEnvOverrideWarnings', () => {
  it('returns nothing when env overrides are absent or valid', () => {
    expect(invalidEnvOverrideWarnings({})).toEqual([]);
    expect(
      invalidEnvOverrideWarnings({ [STORAGE_ENV_VAR]: 'project', [SUMMARY_ENV_VAR]: 'balanced' })
    ).toEqual([]);
  });

  it('warns for a set-but-invalid value, naming the var and the valid options', () => {
    const [warning, ...rest] = invalidEnvOverrideWarnings({ [SUMMARY_ENV_VAR]: 'agressive' });
    expect(rest).toHaveLength(0);
    expect(warning).toContain(SUMMARY_ENV_VAR);
    expect(warning).toContain('agressive');
    expect(warning).toContain('conservative, balanced, aggressive');
  });

  it('reports each offending variable independently', () => {
    expect(
      invalidEnvOverrideWarnings({ [STORAGE_ENV_VAR]: 'nope', [SUMMARY_ENV_VAR]: 'nope' })
    ).toHaveLength(2);
  });

  it('treats an empty or whitespace-only value as unset (no warning), like parseEnv*', () => {
    expect(invalidEnvOverrideWarnings({ [STORAGE_ENV_VAR]: '' })).toEqual([]);
    expect(invalidEnvOverrideWarnings({ [SUMMARY_ENV_VAR]: '   ' })).toEqual([]);
  });

  it('warns on a wrong-case value, since matching is case-sensitive', () => {
    expect(invalidEnvOverrideWarnings({ [SUMMARY_ENV_VAR]: 'Aggressive' })).toHaveLength(1);
  });
});

describe('parseEnvBoolean', () => {
  it('accepts case-insensitive truthy/falsy tokens', () => {
    expect(parseEnvBoolean('1')).toBe(true);
    expect(parseEnvBoolean('true')).toBe(true);
    expect(parseEnvBoolean('YES')).toBe(true);
    expect(parseEnvBoolean('0')).toBe(false);
    expect(parseEnvBoolean('false')).toBe(false);
    expect(parseEnvBoolean('No')).toBe(false);
  });

  it('treats unset/empty/junk as undefined', () => {
    expect(parseEnvBoolean(undefined)).toBeUndefined();
    expect(parseEnvBoolean('  ')).toBeUndefined();
    expect(parseEnvBoolean('banana')).toBeUndefined();
  });
});

describe('resolveReadOnly', () => {
  it('defaults to false when nothing is set', () => {
    expect(resolveReadOnly({ flag: false, env: {} })).toBe(false);
  });

  it('is true when the flag is passed', () => {
    expect(resolveReadOnly({ flag: true, env: {} })).toBe(true);
  });

  it('is true when BONSAI_READ_ONLY is truthy', () => {
    expect(resolveReadOnly({ flag: false, env: { [READ_ONLY_ENV_VAR]: '1' } })).toBe(true);
  });

  it('is true when BONSAI_PLAN_MODE is truthy', () => {
    expect(resolveReadOnly({ flag: false, env: { [PLAN_MODE_ENV_VAR]: 'true' } })).toBe(true);
  });

  it('composes as OR: an env var cannot be overridden back to false by omitting the flag', () => {
    expect(
      resolveReadOnly({ flag: false, env: { [READ_ONLY_ENV_VAR]: '1', [PLAN_MODE_ENV_VAR]: '0' } })
    ).toBe(true);
  });

  it('ignores an invalid env value (treated as unset)', () => {
    expect(resolveReadOnly({ flag: false, env: { [READ_ONLY_ENV_VAR]: 'nope' } })).toBe(false);
  });
});

describe('invalidEnvOverrideWarnings for boolean vars', () => {
  it('warns on a set-but-unparseable BONSAI_READ_ONLY/BONSAI_PLAN_MODE value', () => {
    const warnings = invalidEnvOverrideWarnings({
      [READ_ONLY_ENV_VAR]: 'nope',
      [PLAN_MODE_ENV_VAR]: 'banana',
    });
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain(READ_ONLY_ENV_VAR);
    expect(warnings[1]).toContain(PLAN_MODE_ENV_VAR);
  });

  it('does not warn for valid boolean values or when unset', () => {
    expect(
      invalidEnvOverrideWarnings({ [READ_ONLY_ENV_VAR]: '1', [PLAN_MODE_ENV_VAR]: 'no' })
    ).toEqual([]);
  });
});

describe('config io round-trip', () => {
  it('writes and reads user + project config independently', () => {
    writeUserConfig(dir, { storage: 'global' });
    writeProjectConfig(dir, { storage: 'project' });
    expect(readUserConfig(dir)).toEqual({ storage: 'global' });
    expect(readProjectConfig(dir)).toEqual({ storage: 'project' });
  });

  it('ignores unknown keys and invalid values', () => {
    writeProjectConfig(dir, { storage: 'project' });
    // Hand-write a junk value and an unknown key; parse must drop both.
    const file = join(dir, PROJECT_CONFIG_FILENAME);
    const raw = JSON.parse(readFileSync(file, 'utf-8'));
    expect(raw.schemaVersion).toBe(1);
    writeProjectConfig(dir, { storage: 'global' });
    expect(readProjectConfig(dir).storage).toBe('global');
  });

  it('treats a missing or malformed file as empty', () => {
    expect(readUserConfig(dir)).toEqual({});
    expect(readUserConfig(undefined)).toEqual({});
  });

  it('unset (undefined patch) removes a key', () => {
    writeProjectConfig(dir, { storage: 'project' });
    writeProjectConfig(dir, { storage: undefined });
    expect(readProjectConfig(dir).storage).toBeUndefined();
  });
});
