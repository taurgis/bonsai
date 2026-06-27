import { describe, it, expect, vi } from 'vitest';
import {
  assertRenderedHttpOk,
  fetchRenderedHtml,
  findChromePath,
  ResponseCapture,
  waitForContentReady,
  type CdpPage,
} from './browser.js';

describe('browser rendering unit and integration tests', () => {
  it('successfully locates Chrome executable or throws', () => {
    try {
      const path = findChromePath();
      expect(path).toBeDefined();
      expect(typeof path).toBe('string');
    } catch (err) {
      expect((err as Error).message).toContain('No Chrome or Chromium browser found');
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

// A fake CdpPage that lets tests drive Network.* events and stub getResponseBody,
// without spawning a real browser.
function makeFakePage(bodies: Record<string, { body: string; base64Encoded?: boolean }>): {
  page: CdpPage;
  emit: (event: string, params: unknown) => void;
} {
  const handlers = new Map<string, Array<(params: any) => void>>();
  const client = {
    on(event: string, handler: (params: any) => void) {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    },
    send(method: string, params: any) {
      if (method === 'Network.getResponseBody') {
        const entry = bodies[params.requestId];
        return entry
          ? Promise.resolve({ body: entry.body, base64Encoded: entry.base64Encoded ?? false })
          : Promise.reject(new Error('no body'));
      }
      return Promise.resolve({});
    },
  };
  const page = { client, sessionId: 'S', close: vi.fn() } as unknown as CdpPage;
  const emit = (event: string, p: unknown) =>
    (handlers.get(`S:${event}`) ?? []).forEach((h) => h(p));
  return { page, emit };
}

describe('assertRenderedHttpOk', () => {
  it('throws on a 4xx main-document status', () => {
    expect(() => assertRenderedHttpOk({ status: 404, statusText: 'Not Found' })).toThrow(
      'Fetch failed with status 404 Not Found'
    );
  });

  it('throws on a 5xx main-document status', () => {
    expect(() => assertRenderedHttpOk({ status: 503, statusText: 'Service Unavailable' })).toThrow(
      'Fetch failed with status 503 Service Unavailable'
    );
  });

  it('accepts a 2xx main-document status', () => {
    expect(() => assertRenderedHttpOk({ status: 200, statusText: 'OK' })).not.toThrow();
  });

  it('does not throw when no document response was observed', () => {
    expect(() => assertRenderedHttpOk(undefined)).not.toThrow();
  });
});

describe('ResponseCapture', () => {
  it('matches a request by URL predicate and returns its body after loadingFinished', async () => {
    const { page, emit } = makeFakePage({ r1: { body: '{"ok":true}' } });
    const capture = new ResponseCapture(page, [
      { key: 'coveo', test: ({ url }) => url.includes('/coveo/') },
    ]);

    emit('Network.requestWillBeSent', { requestId: 'r1', request: { url: 'https://x/coveo/v2' } });
    emit('Network.loadingFinished', { requestId: 'r1' });

    expect(await capture.waitFor('coveo', 1000)).toBe('{"ok":true}');
  });

  it('tells two same-URL requests apart by post data', async () => {
    const { page, emit } = makeFakePage({ tok: { body: 'TOKEN' }, other: { body: 'OTHER' } });
    const capture = new ResponseCapture(page, [
      {
        key: 'token',
        test: ({ url, postData }) => url.includes('/aura') && !!postData?.includes('getToken'),
      },
    ]);

    emit('Network.requestWillBeSent', {
      requestId: 'other',
      request: { url: 'https://x/aura', postData: 'doStuff' },
    });
    emit('Network.requestWillBeSent', {
      requestId: 'tok',
      request: { url: 'https://x/aura', postData: 'getToken=1' },
    });
    emit('Network.loadingFinished', { requestId: 'other' });
    emit('Network.loadingFinished', { requestId: 'tok' });

    expect(await capture.waitFor('token', 1000)).toBe('TOKEN');
  });

  it('skips matching responses rejected by accept and captures the first accepted one', async () => {
    const { page, emit } = makeFakePage({
      a: { body: 'not-a-token' },
      b: { body: 'TOKEN' },
    });
    const capture = new ResponseCapture(page, [
      {
        key: 'token',
        test: ({ url }) => url.includes('/aura'),
        accept: (body) => body === 'TOKEN',
      },
    ]);

    // Both requests hit /aura; only the second body is accepted.
    emit('Network.requestWillBeSent', { requestId: 'a', request: { url: 'https://x/aura' } });
    emit('Network.requestWillBeSent', { requestId: 'b', request: { url: 'https://x/aura' } });
    emit('Network.loadingFinished', { requestId: 'a' });
    emit('Network.loadingFinished', { requestId: 'b' });

    expect(await capture.waitFor('token', 1000)).toBe('TOKEN');
  });

  it('resolves null on timeout when no response matches', async () => {
    const { page } = makeFakePage({});
    const capture = new ResponseCapture(page, [{ key: 'coveo', test: () => false }]);
    expect(await capture.waitFor('coveo', 5)).toBeNull();
  });

  it('decodes base64-encoded bodies', async () => {
    const encoded = Buffer.from('héllo').toString('base64');
    const { page, emit } = makeFakePage({ r1: { body: encoded, base64Encoded: true } });
    const capture = new ResponseCapture(page, [{ key: 'k', test: () => true }]);

    emit('Network.requestWillBeSent', { requestId: 'r1', request: { url: 'https://x' } });
    emit('Network.loadingFinished', { requestId: 'r1' });

    expect(await capture.waitFor('k', 1000)).toBe('héllo');
  });
});

describe('waitForContentReady unit tests', () => {
  it('resolves immediately if page has settled content', async () => {
    let callCount = 0;
    const client = {
      on: vi.fn(),
      send: vi.fn(async (method) => {
        if (method === 'Runtime.evaluate') {
          callCount++;
          // First poll: has: true, len: 100
          // Second poll: has: true, len: 100 (stable/not grew, so returns)
          return { result: { value: { has: true, len: 100 } } };
        }
        return {};
      }),
    };
    const page = { client, sessionId: 'S', close: vi.fn() } as unknown as CdpPage;

    await waitForContentReady(page, ['.content'], 10, 5000);
    expect(callCount).toBeGreaterThanOrEqual(2);
  });

  it('polls and waits for rendering to settle if content grows', async () => {
    let callCount = 0;
    const client = {
      on: vi.fn(),
      send: vi.fn(async (method) => {
        if (method === 'Runtime.evaluate') {
          callCount++;
          if (callCount === 1) {
            // First poll: has: true, len: 10
            return { result: { value: { has: true, len: 10 } } };
          }
          if (callCount === 2) {
            // Second poll: has: true, len: 100 (grew)
            return { result: { value: { has: true, len: 100 } } };
          }
          // Third and fourth poll: has: true, len: 100 (settles)
          return { result: { value: { has: true, len: 100 } } };
        }
        return {};
      }),
    };
    const page = { client, sessionId: 'S', close: vi.fn() } as unknown as CdpPage;

    await waitForContentReady(page, ['.content'], 10, 5000);
    expect(callCount).toBeGreaterThanOrEqual(3);
  });
});

describe('findChromePath unit tests', () => {
  it('prefers process.env.CHROME_PATH if set and points to an existing file', () => {
    const originalEnv = process.env.CHROME_PATH;
    try {
      // Point CHROME_PATH to this test file itself, which is guaranteed to exist.
      process.env.CHROME_PATH = import.meta.filename;
      const path = findChromePath();
      expect(path).toBe(import.meta.filename);
    } finally {
      process.env.CHROME_PATH = originalEnv;
    }
  });
});
