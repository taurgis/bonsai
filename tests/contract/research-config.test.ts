import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runContract } from './runner.ts';

// Each test runs the real CLI in an isolated cwd (for the project config + cache), an isolated
// XDG_DATA_HOME (for the global cache), and an isolated XDG_CONFIG_HOME (for the user-level config)
// so tests never read or write the developer's real research cache or config.
let cwd: string;
let xdg: string;
let cfg: string;
beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'fnr-cfg-cwd-'));
  xdg = mkdtempSync(join(tmpdir(), 'fnr-cfg-xdg-'));
  cfg = mkdtempSync(join(tmpdir(), 'fnr-cfg-home-'));
});
afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
  rmSync(xdg, { recursive: true, force: true });
  rmSync(cfg, { recursive: true, force: true });
});

const env = () => ({ XDG_DATA_HOME: xdg, XDG_CONFIG_HOME: cfg });
const PROJECT_CONFIG = '.bonsai.json';
const PROJECT_CACHE = join('.bonsai', 'research');

describe('config command', () => {
  it('set --local writes the project config file', () => {
    const r = runContract(['config', 'set', 'storage', 'project', '--local'], {
      cwd,
      env: env(),
    });
    expect(r.exitCode).toBe(0);
    const written = JSON.parse(readFileSync(join(cwd, PROJECT_CONFIG), 'utf-8'));
    expect(written.storage).toBe('project');
  });

  it('round-trips via get and list, and unset restores the default', () => {
    runContract(['config', 'set', 'storage=project', '--local'], { cwd, env: env() });
    expect(
      runContract(['config', 'get', 'storage', '--local'], { cwd, env: env() }).stdout
    ).toContain('project');

    const list = runContract(['config', 'list'], { cwd, env: env() });
    expect(list.stdout).toContain('storage');
    expect(list.stdout).toContain('project');

    runContract(['config', 'unset', 'storage', '--local'], { cwd, env: env() });
    // After unset the project file no longer pins storage → effective default is global.
    expect(runContract(['config', 'get', 'storage'], { cwd, env: env() }).stdout).toContain(
      'global'
    );
  });

  it('rejects an unknown key and an invalid value with exit 2', () => {
    expect(runContract(['config', 'get', 'nope'], { cwd, env: env() }).exitCode).toBe(2);
    expect(runContract(['config', 'set', 'storage', 'bogus'], { cwd, env: env() }).exitCode).toBe(
      2
    );
  });

  it('rejects --global and --local together with exit 2', () => {
    const r = runContract(['config', 'set', 'storage', 'project', '--global', '--local'], {
      cwd,
      env: env(),
    });
    expect(r.exitCode).toBe(2);
  });

  it('dry-run reports the change without writing the file', () => {
    const r = runContract(['config', 'set', 'storage', 'project', '--local', '--dry-run'], {
      cwd,
      env: env(),
    });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('[dry-run]');
    expect(existsSync(join(cwd, PROJECT_CONFIG))).toBe(false);
  });
});

describe('storage routing end to end', () => {
  function setProject() {
    runContract(['config', 'set', 'storage', 'project', '--local'], {
      cwd,
      env: env(),
    });
  }

  // The contract runner has no stdin channel, so imports use --file with a note written into cwd.
  function noteFile(name: string, body: string): string {
    const path = join(cwd, name);
    writeFileSync(path, body, 'utf-8');
    return path;
  }

  it('caches a clean import in the project tree', () => {
    setProject();
    const file = noteFile('clean.md', '# Clean\nOrdinary documentation about widgets.\n');
    const r = runContract(
      ['import', 'https://example.com/clean', '--file', file, '--topic', 'clean'],
      {
        cwd,
        env: env(),
      }
    );
    expect(r.exitCode).toBe(0);
    expect(existsSync(join(cwd, PROJECT_CACHE))).toBe(true);
  });

  it('redirects a secret-bearing import to the global cache and warns', () => {
    setProject();
    const file = noteFile('secret.md', '# Setup\nexport TOKEN=ghp_' + 'a'.repeat(36) + '\n');
    const r = runContract(
      ['import', 'https://example.com/secret', '--file', file, '--topic', 'secret', '--json'],
      { cwd, env: env(), raw: true }
    );
    const envelope = JSON.parse(r.stdout);
    expect(envelope.data.cache.redirectedToGlobal).toBe(true);
    expect(envelope.data.cache.path.startsWith(xdg)).toBe(true);
    expect(r.stderr).toContain('global cache instead of the project');
    // The token type is named; the secret value itself is never echoed.
    expect(r.stderr).not.toContain('ghp_');
  });

  it('list falls back to the global cache for project storage', () => {
    setProject();
    const file = noteFile('g.md', '# Global\nContent stored globally.\n');
    runContract(
      [
        'import',
        'https://example.com/g',
        '--file',
        file,
        '--topic',
        'globaltopic',
        '--storage',
        'global',
      ],
      { cwd, env: env() }
    );
    const r = runContract(['list', '--topic', 'globaltopic', '--json'], {
      cwd,
      env: env(),
      raw: true,
    });
    const envelope = JSON.parse(r.stdout);
    expect(envelope.data.length).toBeGreaterThan(0);
    expect(envelope.data.some((x: { topic: string }) => x.topic === 'globaltopic')).toBe(true);
  });
});
