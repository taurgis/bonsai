import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { atomicWriteFile } from './atomic-write.js';

describe('atomicWriteFile', () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('writes content atomically and leaves no temp file behind', () => {
    dir = mkdtempSync(join(tmpdir(), 'fnr-atomic-'));
    const dest = join(dir, 'out.txt');

    atomicWriteFile(dest, 'hello world');

    expect(readFileSync(dest, 'utf-8')).toBe('hello world');
    // Only the destination remains; no `.tmp` siblings.
    expect(readdirSync(dir)).toEqual(['out.txt']);
  });

  it('cleans up the temp file and rethrows when the rename fails (dest is a directory)', () => {
    dir = mkdtempSync(join(tmpdir(), 'fnr-atomic-'));
    // Make the destination a directory so renameSync(tmp, dest) fails (EISDIR/ENOTEMPTY).
    const dest = join(dir, 'dest-as-dir');
    mkdirSync(dest);

    expect(() => atomicWriteFile(dest, 'content')).toThrow();

    // The catch path must remove the half-written temp; only the directory should remain.
    expect(existsSync(dest)).toBe(true);
    expect(readdirSync(dir)).toEqual(['dest-as-dir']);
  });

  it('rethrows when the temp write fails and there is no temp to clean up', () => {
    // Parent directory does not exist, so writeFileSync(tmp, …) throws before any temp exists.
    const missing = join(tmpdir(), 'fnr-atomic-does-not-exist-12345', 'out.txt');
    expect(existsSync(missing)).toBe(false);

    expect(() => atomicWriteFile(missing, 'content')).toThrow();
    expect(existsSync(missing)).toBe(false);
  });
});
