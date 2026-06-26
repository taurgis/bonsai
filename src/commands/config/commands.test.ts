import { describe, it, expect, afterEach, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ConfigGet from './get.js';
import ConfigSet from './set.js';
import ConfigList from './list.js';
import ConfigUnset from './unset.js';
import { useIsolatedCache } from '../../../tests/helpers/isolated-cache.js';

// Drive the config commands in-process. useIsolatedCache points XDG_CONFIG_HOME (user config) and
// the cwd (project config) at per-test temp dirs, so commands never touch the developer's real
// config. oclif's logJson routes through console.log, captured here for --json envelope assertions.
const iso = useIsolatedCache();

afterEach(() => {
  vi.restoreAllMocks();
});

const projectConfig = () => join(iso.cwd, '.bonsai.json');

async function captureLog(fn: () => Promise<unknown>): Promise<string[]> {
  const lines: string[] = [];
  vi.spyOn(console, 'log').mockImplementation(
    (...a: unknown[]) => void lines.push(a.map(String).join(' '))
  );
  await fn();
  return lines;
}

describe('config set', () => {
  it('writes the project file with --local', async () => {
    const result = (await ConfigSet.run(['storage', 'project', '--local'])) as any;
    expect(result).toMatchObject({
      key: 'storage',
      value: 'project',
      scope: 'project',
      dryRun: false,
    });
    expect(JSON.parse(readFileSync(projectConfig(), 'utf-8')).storage).toBe('project');
  });

  it('writes the user file by default (no scope flag)', async () => {
    // Set a non-default user value so the round-trip read proves it landed in user scope.
    await ConfigSet.run(['storage', 'project', '--global']);
    const result = (await ConfigSet.run(['storage', 'global'])) as any;
    expect(result).toMatchObject({ scope: 'user', value: 'global', dryRun: false });
    expect(existsSync(projectConfig())).toBe(false);
    // Read back through the user scope rather than a hardcoded path (configDir dirname varies in-process).
    expect((await ConfigGet.run(['storage', '--global'])) as any).toMatchObject({
      value: 'global',
    });
  });

  it('accepts the inline key=value form', async () => {
    const result = (await ConfigSet.run(['storage=project', '--local'])) as any;
    expect(result.value).toBe('project');
  });

  it('does not write on --dry-run', async () => {
    const result = (await ConfigSet.run(['storage', 'project', '--local', '--dry-run'])) as any;
    expect(result.dryRun).toBe(true);
    expect(existsSync(projectConfig())).toBe(false);
  });

  it('emits the envelope under --json', async () => {
    const lines = await captureLog(() =>
      ConfigSet.run(['storage', 'project', '--local', '--json'])
    );
    const envelope = JSON.parse(lines.join('\n').trim());
    expect(envelope).toMatchObject({ schemaVersion: 1, ok: true });
    expect(String(envelope.command)).toContain('set');
    expect(envelope.data).toMatchObject({ key: 'storage', value: 'project' });
  });

  it('rejects an invalid value with exit 2', async () => {
    await expect(ConfigSet.run(['storage', 'bogus'])).rejects.toThrow(/Invalid value/);
  });

  it('rejects --global and --local together with exit 2', async () => {
    await expect(ConfigSet.run(['storage', 'project', '--global', '--local'])).rejects.toThrow(
      /mutually exclusive/
    );
  });

  it('rejects a missing key', async () => {
    await expect(ConfigSet.run([])).rejects.toThrow(/Missing required argument: key/);
  });

  it('rejects a missing value', async () => {
    await expect(ConfigSet.run(['storage'])).rejects.toThrow(/Missing required argument: value/);
  });
});

describe('config get', () => {
  it('returns the built-in default effective value', async () => {
    const result = (await ConfigGet.run(['storage'])) as any;
    expect(result).toEqual({ key: 'storage', value: 'global' });
  });

  it('reads the project value with --local after a set', async () => {
    await ConfigSet.run(['storage', 'project', '--local']);
    const result = (await ConfigGet.run(['storage', '--local'])) as any;
    expect(result.value).toBe('project');
  });

  it('reads only the user scope with --global', async () => {
    await ConfigSet.run(['storage', 'project', '--local']);
    // --global ignores the project file, so it falls back to the default.
    const result = (await ConfigGet.run(['storage', '--global'])) as any;
    expect(result.value).toBe('global');
  });

  it('rejects an unknown key with a suggestion', async () => {
    await expect(ConfigGet.run(['storag'])).rejects.toThrow(/Did you mean: storage/);
  });

  it('rejects an unknown key with no near match', async () => {
    await expect(ConfigGet.run(['zzzzz'])).rejects.toThrow(/Unknown config key/);
  });

  it('emits the envelope under --json', async () => {
    const lines = await captureLog(() => ConfigGet.run(['storage', '--json']));
    const envelope = JSON.parse(lines.join('\n').trim());
    expect(envelope).toMatchObject({ schemaVersion: 1, ok: true });
    expect(envelope.data).toMatchObject({ key: 'storage', value: 'global' });
  });
});

describe('config list', () => {
  it('returns the effective values', async () => {
    const result = (await ConfigList.run([])) as any;
    expect(result).toEqual({ storage: 'global', summary: 'conservative' });
  });

  it('reflects a project-level value', async () => {
    await ConfigSet.run(['storage', 'project', '--local']);
    const result = (await ConfigList.run([])) as any;
    expect(result.storage).toBe('project');
  });

  it('reads only the project scope with --local', async () => {
    const result = (await ConfigList.run(['--local'])) as any;
    // Nothing written to the project file yet → key falls back to the default.
    expect(result.storage).toBe('global');
  });

  it('reads only the user scope with --global', async () => {
    const result = (await ConfigList.run(['--global'])) as any;
    expect(result.storage).toBe('global');
  });

  it('emits the envelope under --json', async () => {
    const lines = await captureLog(() => ConfigList.run(['--json']));
    const envelope = JSON.parse(lines.join('\n').trim());
    expect(envelope).toMatchObject({ schemaVersion: 1, ok: true, data: { storage: 'global' } });
  });

  it('rejects --global and --local together', async () => {
    await expect(ConfigList.run(['--global', '--local'])).rejects.toThrow(/mutually exclusive/);
  });
});

describe('config unset', () => {
  it('removes a project value so the effective default returns', async () => {
    await ConfigSet.run(['storage', 'project', '--local']);
    const result = (await ConfigUnset.run(['storage', '--local'])) as any;
    expect(result).toMatchObject({ key: 'storage', scope: 'project', dryRun: false });
    expect((await ConfigGet.run(['storage'])) as any).toEqual({ key: 'storage', value: 'global' });
  });

  it('does not write on --dry-run', async () => {
    await ConfigSet.run(['storage', 'project', '--local']);
    const result = (await ConfigUnset.run(['storage', '--local', '--dry-run'])) as any;
    expect(result.dryRun).toBe(true);
    expect(JSON.parse(readFileSync(projectConfig(), 'utf-8')).storage).toBe('project');
  });

  it('rejects an unknown key', async () => {
    await expect(ConfigUnset.run(['nope'])).rejects.toThrow(/Unknown config key/);
  });

  it('removes a user-scope value (no --local) and reports user scope', async () => {
    await ConfigSet.run(['storage', 'project']); // user scope
    const result = (await ConfigUnset.run(['storage'])) as any;
    expect(result).toMatchObject({ scope: 'user', dryRun: false });
    expect((await ConfigGet.run(['storage', '--global'])) as any).toMatchObject({
      value: 'global',
    });
  });

  it('rejects --global and --local together', async () => {
    await expect(ConfigUnset.run(['storage', '--global', '--local'])).rejects.toThrow(
      /mutually exclusive/
    );
  });

  it('emits the envelope under --json', async () => {
    await ConfigSet.run(['storage', 'project', '--local']);
    const lines = await captureLog(() => ConfigUnset.run(['storage', '--local', '--json']));
    const envelope = JSON.parse(lines.join('\n').trim());
    expect(envelope).toMatchObject({ schemaVersion: 1, ok: true });
    expect(envelope.data).toMatchObject({ key: 'storage', scope: 'project' });
  });
});
