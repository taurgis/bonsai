import { describe, it, expect, vi } from 'vitest';
import ResearchStatus from './status.js';
import ResearchImport from './import.js';

describe('status command unit tests', () => {
  it('handles uncached miss status', async () => {
    const result = (await ResearchStatus.run(['https://example.com/not-cached-status'])) as any;
    expect(result).toBeDefined();
    expect(result.status).toBe('miss');
    expect(result.freshness).toBe('stale_expired');
    expect(result.action).toBe('would_fetch');
  });

  it('handles cached hit status', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValue('# Hello World');

    await ResearchImport.run(['https://example.com/cached-status', '--stdin']);

    const result = (await ResearchStatus.run(['https://example.com/cached-status'])) as any;
    expect(result).toBeDefined();
    expect(result.status).toBe('hit');
    expect(result.freshness).toBe('fresh');
    expect(result.action).toBe('would_return_cached');

    readSpy.mockRestore();
  });
});
