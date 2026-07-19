import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertRenderedHttpOk,
  buildChromeArgs,
  describeNavigationFailure,
  describeUnsafeNavigationTarget,
  fetchRenderedHtml,
  findChromePath,
  ResponseCapture,
  SANDBOX_EGRESS_ERROR_MARKER,
  type CdpPage,
} from './browser.js';
import { execFileSync } from 'node:child_process';
import { ALL_PROXY_ENV_VARS, CA_BUNDLE_ENV_VARS } from './proxy.js';
import { hasInternetAccess } from '../../../tests/helpers/network.js';

describe('buildChromeArgs (sandbox proxy CLI flags)', () => {
  const originalEnv: Record<string, string | undefined> = {};
  const originalCaEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ALL_PROXY_ENV_VARS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
    // The CA bundle vars aren't proxy vars, but they gate getChromeSpkiArgs the same way, and a
    // sandbox that sets HTTPS_PROXY typically also sets these — clear them so each test controls
    // its own scenario instead of picking up whatever the host environment happens to have set.
    for (const key of CA_BUNDLE_ENV_VARS) {
      originalCaEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ALL_PROXY_ENV_VARS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
    for (const key of CA_BUNDLE_ENV_VARS) {
      if (originalCaEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalCaEnv[key];
    }
  });

  it('has no proxy-server flag when no sandbox egress proxy is configured', () => {
    const args = buildChromeArgs();
    expect(args.some((a) => a.startsWith('--proxy-server='))).toBe(false);
    // The rest of the fixed flags are always present regardless of proxy state.
    expect(args).toContain('--headless=new');
  });

  it('includes the scheme-qualified proxy-server flag when a sandbox egress proxy is configured', () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:46271';
    const args = buildChromeArgs();
    expect(args).toContain('--proxy-server=https=http://127.0.0.1:46271');
  });

  it('includes a proxy-bypass-list flag reflecting NO_PROXY when both are set', () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:46271';
    process.env.NO_PROXY = 'internal.example.com';
    const args = buildChromeArgs();
    expect(args).toContain('--proxy-bypass-list=internal.example.com,*.internal.example.com');
  });

  it('has no ssl-version-max flag when no sandbox egress proxy is configured', () => {
    const args = buildChromeArgs();
    expect(args).not.toContain('--ssl-version-max=tls1.2');
  });

  it('caps TLS to 1.2 when a sandbox egress proxy is configured', () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:46271';
    const args = buildChromeArgs();
    expect(args).toContain('--ssl-version-max=tls1.2');
  });

  it('has no --ignore-certificate-errors-spki-list flag when no CA bundle is discoverable', () => {
    // Also configure a proxy: the flag must stay absent purely because no CA bundle env var
    // points at a real file — proxy presence alone must never trigger the pin.
    process.env.HTTPS_PROXY = 'http://127.0.0.1:46271';
    const args = buildChromeArgs();
    expect(args.some((a) => a.startsWith('--ignore-certificate-errors-spki-list='))).toBe(false);
  });

  function generateTestCaBundle(dir: string): { certPath: string; expectedHash: string } {
    const certPath = join(dir, 'ca.pem');
    execFileSync('openssl', [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      join(dir, 'ca.key'),
      '-out',
      certPath,
      '-days',
      '1',
      '-subj',
      '/CN=bonsai-test-ca',
    ]);
    const pubkey = execFileSync('openssl', ['x509', '-in', certPath, '-pubkey', '-noout']);
    const der = execFileSync('openssl', ['pkey', '-pubin', '-outform', 'der'], { input: pubkey });
    const digest = execFileSync('openssl', ['dgst', '-sha256', '-binary'], { input: der });
    const expectedHash = execFileSync('openssl', ['enc', '-base64', '-A'], { input: digest })
      .toString('utf8')
      .trim();
    return { certPath, expectedHash };
  }

  it('pins the SPKI hash of the discovered CA bundle when a proxy is configured', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bonsai-ca-bundle-'));
    try {
      const { certPath, expectedHash } = generateTestCaBundle(dir);
      process.env.HTTPS_PROXY = 'http://127.0.0.1:46271';
      process.env.NODE_EXTRA_CA_CERTS = certPath;
      const args = buildChromeArgs();
      expect(args).toContain(`--ignore-certificate-errors-spki-list=${expectedHash}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('pins the discovered CA bundle even when no proxy is configured', () => {
    // A CA bundle env var can be set by an environment that intercepts HTTPS transparently (or
    // via a proxy Chrome reaches without an explicit --proxy-server flag), with no HTTPS_PROXY/
    // HTTP_PROXY set at all. Chrome still needs to trust that CA regardless of proxy detection.
    const dir = mkdtempSync(join(tmpdir(), 'bonsai-ca-bundle-'));
    try {
      const { certPath, expectedHash } = generateTestCaBundle(dir);
      process.env.NODE_EXTRA_CA_CERTS = certPath;
      const args = buildChromeArgs();
      expect(args).toContain(`--ignore-certificate-errors-spki-list=${expectedHash}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

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

  it('fetches and renders example.com', async (ctx) => {
    try {
      findChromePath();
    } catch {
      // Skip test if Chrome is not installed on testing environment
      return;
    }
    // Chrome is available (e.g. the Playwright-provisioned browser in a sandbox) but that sandbox
    // may still deny egress to arbitrary hosts like example.com; skip rather than fail on that
    // environment limitation, mirroring fetch.test.ts's use of the same probe.
    if (!(await hasInternetAccess())) ctx.skip('no internet access in this sandbox');

    const result = await fetchRenderedHtml('https://example.com', {
      timeoutMs: 12000,
    });

    expect(result.status).toBe(200);
    expect(result.content).toContain('Example Domain');
    expect(result.content.toLowerCase()).toContain('</html>');
  });

  it('rejects pages exceeding body limit', async (ctx) => {
    try {
      findChromePath();
    } catch {
      return;
    }
    if (!(await hasInternetAccess())) ctx.skip('no internet access in this sandbox');

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

  it('rejects on timeout', async (ctx) => {
    try {
      findChromePath();
    } catch {
      return;
    }
    if (!(await hasInternetAccess())) ctx.skip('no internet access in this sandbox');

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

// This is the guard openCdpPage's Fetch-domain interception runs against every navigated (and
// redirected) Document request, closing the SSRF gap where a page that starts on a safe public
// host redirects the rendered-fallback capture into a private/internal address or a non-http(s)
// scheme — something Chrome would otherwise follow with no further safety check. IP-literal inputs
// keep these deterministic and network-free (checkDnsSafety short-circuits DNS lookup for them).
describe('describeUnsafeNavigationTarget', () => {
  it('blocks a private/loopback IP target', async () => {
    const err = await describeUnsafeNavigationTarget('http://127.0.0.1:19999/');
    expect(err?.message).toContain('blocked local or private target');
  });

  it('allows a safe public IP target', async () => {
    expect(await describeUnsafeNavigationTarget('http://8.8.8.8/')).toBeNull();
  });

  it('blocks a non-http(s) scheme, e.g. a redirect to file:', async () => {
    const err = await describeUnsafeNavigationTarget('file:///etc/passwd');
    expect(err?.message).toContain('Unsupported protocol "file:"');
  });

  it('blocks a redirect target carrying embedded credentials', async () => {
    const err = await describeUnsafeNavigationTarget('http://user:pass@example.com/');
    expect(err?.message).toContain('usernames or passwords');
  });

  it('blocks an unparseable URL', async () => {
    const err = await describeUnsafeNavigationTarget('not a url');
    expect(err?.message).toContain('Could not parse');
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

  it('finds the Playwright-provisioned Chromium under PLAYWRIGHT_BROWSERS_PATH', () => {
    const originalChromePath = process.env.CHROME_PATH;
    const originalBrowsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
    const dir = mkdtempSync(join(tmpdir(), 'bonsai-pw-browsers-'));
    const chromiumPath = join(dir, 'chromium');
    writeFileSync(chromiumPath, '#!/bin/sh\n');
    chmodSync(chromiumPath, 0o755);
    try {
      delete process.env.CHROME_PATH;
      process.env.PLAYWRIGHT_BROWSERS_PATH = dir;
      expect(findChromePath()).toBe(chromiumPath);
    } finally {
      if (originalChromePath === undefined) delete process.env.CHROME_PATH;
      else process.env.CHROME_PATH = originalChromePath;
      if (originalBrowsersPath === undefined) delete process.env.PLAYWRIGHT_BROWSERS_PATH;
      else process.env.PLAYWRIGHT_BROWSERS_PATH = originalBrowsersPath;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('describeNavigationFailure', () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ALL_PROXY_ENV_VARS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ALL_PROXY_ENV_VARS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  it('returns a bare navigation-failed message when no proxy is configured', () => {
    const err = describeNavigationFailure('net::ERR_CONNECTION_TIMED_OUT', 'https://example.com/');
    expect(err.message).toBe('Navigation failed: net::ERR_CONNECTION_TIMED_OUT');
  });

  it('returns a bare navigation-failed message for non-proxy net errors even with a proxy configured', () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:9999';
    const err = describeNavigationFailure('net::ERR_CONNECTION_TIMED_OUT', 'https://example.com/');
    expect(err.message).toBe('Navigation failed: net::ERR_CONNECTION_TIMED_OUT');
  });

  it('names the sandbox egress policy when a configured proxy rejects the tunnel', () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:9999';
    const err = describeNavigationFailure(
      'net::ERR_TUNNEL_CONNECTION_FAILED',
      'https://developer.salesforce.com/docs/foo'
    );
    expect(err.message).toContain(SANDBOX_EGRESS_ERROR_MARKER);
    expect(err.message).toContain('developer.salesforce.com');
    expect(err.message).toContain('net::ERR_TUNNEL_CONNECTION_FAILED');
  });

  it('also flags ERR_PROXY_CONNECTION_FAILED and ERR_SOCKS_CONNECTION_FAILED as sandbox egress blocks', () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:9999';
    expect(
      describeNavigationFailure('net::ERR_PROXY_CONNECTION_FAILED', 'https://x.example.com/')
        .message
    ).toContain(SANDBOX_EGRESS_ERROR_MARKER);
    expect(
      describeNavigationFailure('net::ERR_SOCKS_CONNECTION_FAILED', 'https://x.example.com/')
        .message
    ).toContain(SANDBOX_EGRESS_ERROR_MARKER);
  });

  it('falls back to the raw URL if it cannot be parsed as a hostname', () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:9999';
    const err = describeNavigationFailure('net::ERR_TUNNEL_CONNECTION_FAILED', 'not-a-url');
    expect(err.message).toContain('not-a-url');
  });
});
