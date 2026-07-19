import { describe, it, expect } from 'vitest';
import { tryUnknownHelpOutput } from './help-preflight.js';

const root = process.cwd();

describe('tryUnknownHelpOutput', () => {
  it('returns null when argv has no --help', async () => {
    expect(await tryUnknownHelpOutput(['config', 'gett'], root)).toBeNull();
  });

  it('returns null for a valid command help target', async () => {
    expect(await tryUnknownHelpOutput(['list', '--help'], root)).toBeNull();
    expect(await tryUnknownHelpOutput(['config', 'get', '--help'], root)).toBeNull();
  });

  it('returns null for a valid topic (branch) help target', async () => {
    expect(await tryUnknownHelpOutput(['config', '--help'], root)).toBeNull();
  });

  it('returns a usage envelope for unknown command --help', async () => {
    const result = await tryUnknownHelpOutput(['config', 'gett', '--help'], root);
    expect(result).not.toBeNull();
    expect(result!.exitCode).toBe(2);
    expect(result!.json).toBe(false);
    expect(result!.envelope).toMatchObject({
      ok: false,
      exitCode: 2,
      code: expect.any(String),
    });
  });

  it('marks json true when --json is present with unknown --help', async () => {
    const result = await tryUnknownHelpOutput(['config', 'gett', '--help', '--json'], root);
    expect(result).not.toBeNull();
    expect(result!.json).toBe(true);
    expect(result!.exitCode).toBe(2);
  });
});
