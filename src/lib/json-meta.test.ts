import { describe, it, expect } from 'vitest';
import { tryJsonMetaOutput } from './json-meta.js';

describe('tryJsonMetaOutput', () => {
  it('returns null for normal commands that are not help/version meta requests', async () => {
    expect(await tryJsonMetaOutput(['list', '--json'], process.cwd())).toBeNull();
    expect(await tryJsonMetaOutput(['--help'], process.cwd())).toBeNull();
    expect(await tryJsonMetaOutput(['--json'], process.cwd())).toBeNull();
  });

  it('returns a success envelope for --json --help', async () => {
    const result = await tryJsonMetaOutput(['--json', '--help'], process.cwd());
    expect(result).not.toBeNull();
    expect(result!.exitCode).toBe(0);
    expect(result!.envelope).toMatchObject({ ok: true, exitCode: 0 });
    expect(result!.envelope.data).toEqual(
      expect.objectContaining({ help: expect.any(String) })
    );
  });

  it('returns a success envelope for --json --version', async () => {
    const result = await tryJsonMetaOutput(['--version', '--json'], process.cwd());
    expect(result).not.toBeNull();
    expect(result!.exitCode).toBe(0);
    expect(result!.envelope).toMatchObject({ ok: true, exitCode: 0 });
    expect(result!.envelope.data).toEqual(
      expect.objectContaining({
        version: expect.any(String),
        userAgent: expect.any(String),
      })
    );
  });
});
