import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fetchStaticHtml, fetchText, postJson } from './fetcher.js';
import * as dns from 'node:dns/promises';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(),
}));

describe('static HTML fetcher', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
    // Default DNS lookup behavior mock (safe IP)
    vi.mocked(dns.lookup).mockResolvedValue([{ address: '93.184.215.14', family: 4 }] as any);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('fetches static HTML page successfully', async () => {
    const mockResponseHtml = '<!doctype html><html><body>Hello World</body></html>';
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({
        'content-type': 'text/html; charset=utf-8',
        etag: 'w/1234',
        'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT',
      }),
      body: (async function* () {
        yield new TextEncoder().encode(mockResponseHtml);
      })(),
    });

    const result = await fetchStaticHtml('https://example.com/docs');
    expect(result.status).toBe(200);
    expect(result.content).toBe(mockResponseHtml);
    expect(result.etag).toBe('w/1234');
    expect(result.lastModified).toBe('Wed, 21 Oct 2015 07:28:00 GMT');
    expect(result.responseSize).toBe(new TextEncoder().encode(mockResponseHtml).byteLength);
  });

  it('rejects responses with non-HTML content types', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({
        'content-type': 'application/json',
      }),
      body: (async function* () {
        yield new TextEncoder().encode('{"error": true}');
      })(),
    });

    await expect(fetchStaticHtml('https://example.com/docs')).rejects.toThrow(
      /Rejected content type "application\/json". Only HTML is supported./
    );
  });

  it('allows missing content type if body looks like HTML', async () => {
    const mockResponseHtml = '  \n  <!DOCTYPE html><html></html>';
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({}),
      body: (async function* () {
        yield new TextEncoder().encode(mockResponseHtml);
      })(),
    });

    const result = await fetchStaticHtml('https://example.com/docs');
    expect(result.status).toBe(200);
    expect(result.content).toBe(mockResponseHtml);
  });

  it('rejects missing content type if body does not look like HTML', async () => {
    const mockResponseJson = '{"not": "html"}';
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({}),
      body: (async function* () {
        yield new TextEncoder().encode(mockResponseJson);
      })(),
    });

    await expect(fetchStaticHtml('https://example.com/docs')).rejects.toThrow(
      /missing Content-Type and body does not look like HTML/
    );
  });

  it('aborts and fails when body size exceeds limit', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({
        'content-type': 'text/html',
      }),
      body: (async function* () {
        yield new Uint8Array(100);
        yield new Uint8Array(100);
      })(),
    });

    await expect(
      fetchStaticHtml('https://example.com/docs', { bodyLimitBytes: 150 })
    ).rejects.toThrow(/Response body size limit exceeded/);
  });

  it('handles 304 Not Modified', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 304,
      headers: new Headers({
        etag: 'w/1234',
      }),
      body: null,
    });

    const result = await fetchStaticHtml('https://example.com/docs', {
      headers: { 'If-None-Match': 'w/1234' },
    });
    expect(result.status).toBe(304);
    expect(result.content).toBe('');
    expect(result.etag).toBe('w/1234');
  });

  it('blocks private or local resolved IPs', async () => {
    vi.mocked(dns.lookup).mockResolvedValue([{ address: '127.0.0.1', family: 4 }] as any);

    await expect(fetchStaticHtml('https://example.com/docs')).rejects.toThrow(
      /is a blocked local or private target/
    );
  });

  it('blocks private or local redirect targets', async () => {
    // First fetch redirects to unsafe IP
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 302,
      headers: new Headers({
        location: 'https://private-host.com/docs',
      }),
      body: null,
    });

    // Mock DNS lookup to return safe IP for the first host, but unsafe for redirect target
    vi.mocked(dns.lookup).mockImplementation(async (hostname) => {
      if (hostname === 'example.com') {
        return [{ address: '93.184.215.14', family: 4 }] as any;
      }
      return [{ address: '192.168.1.1', family: 4 }] as any;
    });

    await expect(fetchStaticHtml('https://example.com/docs')).rejects.toThrow(
      /is a blocked local or private target/
    );
  });

  it('follows redirect successfully up to maxRedirects limit', async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async (url) => {
      callCount++;
      if (callCount === 1) {
        return {
          status: 301,
          headers: new Headers({
            location: 'https://example.com/new-docs',
          }),
          body: null,
        };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        body: (async function* () {
          yield new TextEncoder().encode('<html></html>');
        })(),
      };
    });

    const result = await fetchStaticHtml('https://example.com/docs');
    expect(result.status).toBe(200);
    expect(result.finalUrl).toBe('https://example.com/new-docs');
  });

  it('fails if redirect limit is exceeded', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 301,
      headers: new Headers({
        location: 'https://example.com/loop',
      }),
      body: null,
    });

    await expect(fetchStaticHtml('https://example.com/docs', { maxRedirects: 2 })).rejects.toThrow(
      /Too many redirects/
    );
  });

  it('fails when a redirect response is missing a Location header', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 302,
      headers: new Headers({}),
      body: null,
    });

    await expect(fetchStaticHtml('https://example.com/docs')).rejects.toThrow(
      /Redirect response status 302 missing Location header/
    );
  });

  it('rejects a non-IP unresolvable hostname (DNS lookup throws)', async () => {
    vi.mocked(dns.lookup).mockRejectedValue(new Error('ENOTFOUND'));
    globalThis.fetch = vi.fn();

    await expect(fetchStaticHtml('https://nope.example/docs')).rejects.toThrow(
      /DNS resolution failed for hostname "nope.example": ENOTFOUND/
    );
  });
});

describe('fetchText (non-HTML text fetcher)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(dns.lookup).mockResolvedValue([{ address: '93.184.215.14', family: 4 }] as any);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns text content without enforcing an HTML content type', async () => {
    const txt = '# Example Docs\n\nllms.txt body';
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/plain', etag: 'w/abc' }),
      body: (async function* () {
        yield new TextEncoder().encode(txt);
      })(),
    });

    const result = await fetchText('https://example.com/llms.txt');
    expect(result.status).toBe(200);
    expect(result.content).toBe(txt);
    expect(result.etag).toBe('w/abc');
  });

  it('returns an empty body on 304 Not Modified', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 304,
      headers: new Headers({ etag: 'w/abc' }),
      body: null,
    });

    const result = await fetchText('https://example.com/page.md', {
      headers: { 'If-None-Match': 'w/abc' },
    });
    expect(result.status).toBe(304);
    expect(result.content).toBe('');
  });

  it('throws on a non-ok status', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers({}),
      body: null,
    });

    await expect(fetchText('https://example.com/missing.md')).rejects.toThrow(
      /Fetch failed with status 404 Not Found/
    );
  });
});

describe('postJson', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(dns.lookup).mockResolvedValue([{ address: '93.184.215.14', family: 4 }] as any);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends a JSON body with merged headers and returns the response text', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({}),
      body: (async function* () {
        yield new TextEncoder().encode('{"hits":[]}');
      })(),
    });
    globalThis.fetch = fetchMock;

    const out = await postJson(
      'https://app-dsn.algolia.net/1/indexes/x/query',
      { params: 'query=test' },
      { 'X-Algolia-API-Key': 'key' }
    );
    expect(out).toBe('{"hits":[]}');

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'content-type': 'application/json',
      'X-Algolia-API-Key': 'key',
    });
    expect(init.body).toBe(JSON.stringify({ params: 'query=test' }));
  });

  it('throws on a non-ok search response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      headers: new Headers({}),
      body: null,
    });

    await expect(postJson('https://app-dsn.algolia.net/1/indexes/x/query', {})).rejects.toThrow(
      /Search request failed with status 403 Forbidden/
    );
  });
});
