import { describe, it, expect } from 'vitest';
import { fetchRenderedHtml, findChromePath } from './browser.js';

describe('browser rendering unit and integration tests', () => {
  it('successfully locates Chrome executable or throws', () => {
    try {
      const path = findChromePath();
      expect(path).toBeDefined();
      expect(typeof path).toBe('string');
    } catch (err) {
      expect((err as Error).message).toContain('Chrome executable not found');
    }
  });

  it('fetches and renders example.com', async () => {
    try {
      findChromePath();
    } catch {
      // Skip test if Chrome is not installed on testing environment
      return;
    }

    const result = await fetchRenderedHtml('https://example.com', {
      timeoutMs: 12000,
    });

    expect(result.status).toBe(200);
    expect(result.content).toContain('Example Domain');
    expect(result.content.toLowerCase()).toContain('</html>');
  });

  it('rejects pages exceeding body limit', async () => {
    try {
      findChromePath();
    } catch {
      return;
    }

    await expect(
      fetchRenderedHtml('https://example.com', {
        bodyLimitBytes: 10,
        timeoutMs: 12000,
      })
    ).rejects.toThrow('Response body size limit exceeded');
  });

  it('rejects unsafe IP/hostnames', async () => {
    await expect(fetchRenderedHtml('http://127.0.0.1/test')).rejects.toThrow(
      'blocked local or private target'
    );
  });

  it('rejects on timeout', async () => {
    try {
      findChromePath();
    } catch {
      return;
    }

    await expect(
      fetchRenderedHtml('https://example.com', {
        timeoutMs: 1,
      })
    ).rejects.toThrow(/timed out/i);
  });
});
