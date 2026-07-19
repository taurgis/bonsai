import { describe, it, expect } from 'vitest';
import { tryJsonMetaOutput } from './json-meta.js';

describe('tryJsonMetaOutput', () => {
  it('returns null for normal commands that are not help/version meta requests', async () => {
    expect(await tryJsonMetaOutput(['list', '--json'], process.cwd())).toBeNull();
    expect(await tryJsonMetaOutput(['--help'], process.cwd())).toBeNull();
    expect(await tryJsonMetaOutput(['--json'], process.cwd())).toBeNull();
  });
});
