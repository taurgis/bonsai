import { describe, it, expect, afterEach } from 'vitest';
import { finalizeBatch } from './batch.js';

describe('finalizeBatch', () => {
  afterEach(() => {
    process.exitCode = undefined;
  });

  it('returns the sole row for a single-URL batch', () => {
    expect(finalizeBatch([{ status: 'hit' }], (r) => r.status === 'miss')).toEqual({
      status: 'hit',
    });
    expect(process.exitCode).toBeUndefined();
  });

  it('returns the array and sets exit 1 when any row fails', () => {
    const rows = [{ status: 'hit' }, { status: 'miss' }];
    expect(finalizeBatch(rows, (r) => r.status === 'miss')).toBe(rows);
    expect(process.exitCode).toBe(1);
  });
});
