import { describe, it, expect } from 'vitest';
import FetchCommand from './fetch.js';
import { useIsolatedCache } from '../../tests/helpers/isolated-cache.js';
import { hasInternetAccess } from '../../tests/helpers/network.js';

/**
 * Internet smoke for the fetch command class. Envelope, exit codes, freshness, and read-only
 * behavior are pinned at higher seams: `fetch-paths.test.ts` (in-process with network mocks) and
 * `tests/contract/*` (subprocess). BaseCommand private-method reach-in was removed for #77.
 */
describe('root fetch command unit tests', () => {
  useIsolatedCache();

  it('runs the command class in-process and returns structured data', async (ctx) => {
    if (!(await hasInternetAccess())) ctx.skip('no internet access in this sandbox');
    const result = await FetchCommand.run(['https://example.com']);
    expect(result).toBeDefined();
    if (result) {
      expect(result).toHaveProperty('schemaVersion', 1);
      expect(result).toHaveProperty('format', 'compressed');
    }
  });

  it('runs command with detailed format', async (ctx) => {
    if (!(await hasInternetAccess())) ctx.skip('no internet access in this sandbox');
    const result = await FetchCommand.run(['https://example.com', '--format', 'detailed']);
    expect(result).toBeDefined();
    if (result) {
      expect(result).toHaveProperty('format', 'detailed');
    }
  });
});
