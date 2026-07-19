import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fetchStaticHtml, fetchText } from './fetcher.js';
import * as dns from 'node:dns/promises';
import * as undici from 'undici';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(),
}));

vi.mock('undici', async (importOriginal) => {
  const actual = await importOriginal<typeof import('undici')>();
  return { ...actual, fetch: vi.fn() };
});

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

describe('sandbox proxy routing', () => {
  const originalFetch = globalThis.fetch;
  const originalHttpsProxy = process.env.HTTPS_PROXY;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(dns.lookup).mockResolvedValue([{ address: '93.184.215.14', family: 4 }] as any);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalHttpsProxy === undefined) delete process.env.HTTPS_PROXY;
    else process.env.HTTPS_PROXY = originalHttpsProxy;
  });

  it('routes through undici with a proxy dispatcher when HTTPS_PROXY is set, bypassing global fetch', async () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:46271';
    const globalFetchMock = vi.fn();
    globalThis.fetch = globalFetchMock;

    const undiciFetchMock = vi.mocked(undici.fetch);
    undiciFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
      body: (async function* () {
        yield new TextEncoder().encode('<!doctype html><html><body>Proxied</body></html>');
      })(),
    } as any);

    const result = await fetchStaticHtml('https://developer.salesforce.com/docs/x');

    expect(result.content).toBe('<!doctype html><html><body>Proxied</body></html>');
    expect(globalFetchMock).not.toHaveBeenCalled();
    expect(undiciFetchMock).toHaveBeenCalledTimes(1);
    const [, init] = undiciFetchMock.mock.calls[0]!;
    expect((init as { dispatcher?: unknown }).dispatcher).toBeDefined();
  });

  it('still validates the resolved IP via local DNS even when a proxy is configured', async () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:46271';
    vi.mocked(dns.lookup).mockResolvedValue([{ address: '10.0.0.5', family: 4 }] as any);

    await expect(fetchStaticHtml('https://developer.salesforce.com/docs/x')).rejects.toThrow(
      /blocked local or private target/
    );
    expect(dns.lookup).toHaveBeenCalled();
  });

  it('still blocks a literal private IP hostname even when a proxy is configured', async () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:46271';

    await expect(fetchStaticHtml('http://169.254.169.254/latest/meta-data')).rejects.toThrow(
      /blocked local or private target/
    );
    // The literal-IP check never needed DNS in the first place, proxy or not.
    expect(dns.lookup).not.toHaveBeenCalled();
  });

  it('routes every hop of a redirect chain through the proxy, validating DNS safety per hop', async () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:46271';
    vi.mocked(dns.lookup).mockImplementation(async (hostname) => {
      if (hostname === 'developer.salesforce.com') {
        return [{ address: '93.184.215.14', family: 4 }] as any;
      }
      return [{ address: '10.0.0.5', family: 4 }] as any; // the redirect target is private
    });

    const undiciFetchMock = vi.mocked(undici.fetch);
    undiciFetchMock.mockResolvedValueOnce({
      status: 302,
      headers: new Headers({ location: 'https://internal.example/docs' }),
      body: null,
    } as any);

    await expect(fetchStaticHtml('https://developer.salesforce.com/docs/x')).rejects.toThrow(
      /blocked local or private target/
    );
    // Only the first hop's fetch happened — the second hop was blocked before doFetch ran.
    expect(undiciFetchMock).toHaveBeenCalledTimes(1);
  });

  it('skips the DNS safety check only when local resolution itself fails and a proxy is available', async () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:46271';
    vi.mocked(dns.lookup).mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));
    vi.mocked(undici.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
      body: (async function* () {
        yield new TextEncoder().encode('<!doctype html><html><body>Proxied</body></html>');
      })(),
    } as any);

    const result = await fetchStaticHtml('https://developer.salesforce.com/docs/x');

    expect(result.content).toBe('<!doctype html><html><body>Proxied</body></html>');
  });

  it('still fails on a local DNS lookup failure when no proxy is configured', async () => {
    delete process.env.HTTPS_PROXY;
    vi.mocked(dns.lookup).mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));

    await expect(fetchStaticHtml('https://nope.example/docs')).rejects.toThrow(
      /DNS resolution failed/
    );
  });

  it('falls back to a direct connection when the proxy refuses to tunnel to the host', async () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:46271';
    const globalFetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
      body: (async function* () {
        yield new TextEncoder().encode('<!doctype html><html><body>Direct</body></html>');
      })(),
    });
    globalThis.fetch = globalFetchMock;

    vi.mocked(undici.fetch).mockRejectedValue(
      new TypeError('fetch failed', {
        cause: new Error('Proxy response (403) !== 200 when HTTP Tunneling'),
      })
    );

    const result = await fetchStaticHtml('https://developer.salesforce.com/docs/x');

    expect(result.content).toBe('<!doctype html><html><body>Direct</body></html>');
    expect(globalFetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives the fallback attempt a fresh, unaborted signal rather than the failed attempt's", async () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:46271';
    const globalFetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
      body: (async function* () {
        yield new TextEncoder().encode('ok');
      })(),
    });
    globalThis.fetch = globalFetchMock;

    vi.mocked(undici.fetch).mockRejectedValue(
      new TypeError('fetch failed', {
        cause: new Error('Proxy response (403) !== 200 when HTTP Tunneling'),
      })
    );

    await fetchStaticHtml('https://developer.salesforce.com/docs/x');

    const [, init] = globalFetchMock.mock.calls[0]!;
    expect((init as { signal: AbortSignal }).signal.aborted).toBe(false);
  });

  it('does not fall back to a direct connection for a transport failure unrelated to the proxy', async () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:46271';
    const globalFetchMock = vi.fn();
    globalThis.fetch = globalFetchMock;

    vi.mocked(undici.fetch).mockRejectedValue(new TypeError('fetch failed'));

    await expect(fetchStaticHtml('https://developer.salesforce.com/docs/x')).rejects.toThrow(
      'fetch failed'
    );
    expect(globalFetchMock).not.toHaveBeenCalled();
  });

  it('does not fall back to a direct connection for a plain HTTP-level rejection', async () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:46271';
    const globalFetchMock = vi.fn();
    globalThis.fetch = globalFetchMock;

    vi.mocked(undici.fetch).mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers({}),
      body: null,
    } as any);

    await expect(fetchStaticHtml('https://developer.salesforce.com/docs/x')).rejects.toThrow(
      /Fetch failed with status 404/
    );
    expect(globalFetchMock).not.toHaveBeenCalled();
  });
});
