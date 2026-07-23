import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveBinCommand } from './bin-command.js';

const dirs: string[] = [];
function tmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'bonsai-bin-command-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('resolveBinCommand', () => {
  it('returns the bare command name when PATH resolves to the same script', () => {
    const dir = tmpDir();
    const script = join(dir, 'cli.mjs');
    writeFileSync(script, '');
    const onPathLink = join(dir, 'bonsai-link');
    symlinkSync(script, onPathLink);

    expect(resolveBinCommand(script, () => onPathLink)).toBe('bonsai');
  });

  it('falls back to an absolute node invocation when PATH resolves elsewhere', () => {
    const dir = tmpDir();
    const script = join(dir, 'cli.mjs');
    const otherScript = join(dir, 'other.mjs');
    writeFileSync(script, '');
    writeFileSync(otherScript, '');

    expect(resolveBinCommand(script, () => otherScript)).toBe(`node "${script}"`);
  });

  it('falls back to an absolute node invocation when the command is not on PATH', () => {
    const dir = tmpDir();
    const script = join(dir, 'cli.mjs');
    writeFileSync(script, '');

    expect(resolveBinCommand(script, () => null)).toBe(`node "${script}"`);
  });

  it('falls back when the PATH match does not resolve to a real file', () => {
    const dir = tmpDir();
    const script = join(dir, 'cli.mjs');
    writeFileSync(script, '');

    expect(resolveBinCommand(script, () => join(dir, 'does-not-exist'))).toBe(`node "${script}"`);
  });
});
