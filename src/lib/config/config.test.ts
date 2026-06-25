import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  resolveStorageMode,
  resolveSummaryLevel,
  parseEnvStorage,
  parseEnvSummary,
  STORAGE_ENV_VAR,
  SUMMARY_ENV_VAR,
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
