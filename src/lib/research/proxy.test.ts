import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  isProxyConfigured,
  getProxyDispatcher,
  getChromeProxyArgs,
  getChromeTlsCompatibilityArgs,
  getCaBundleSpkiHashes,
  getChromeSpkiArgs,
  ALL_PROXY_ENV_VARS,
  CA_BUNDLE_ENV_VARS,
} from './proxy.js';

describe('sandbox proxy detection', () => {
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

  it('reports no proxy configured when no *_PROXY env vars are set', () => {
    expect(isProxyConfigured()).toBe(false);
    expect(getProxyDispatcher()).toBeUndefined();
    expect(getChromeProxyArgs()).toEqual([]);
  });

  it('detects a proxy from HTTPS_PROXY', () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:46271';
    expect(isProxyConfigured()).toBe(true);
    expect(getProxyDispatcher()).toBeDefined();
  });

  it('detects a proxy from the lowercase https_proxy variant', () => {
    process.env.https_proxy = 'http://127.0.0.1:46271';
    expect(isProxyConfigured()).toBe(true);
  });

  it('prefers the lowercase variant when both cases are set, matching undici', () => {
    process.env.HTTPS_PROXY = 'http://uppercase:8080';
    process.env.https_proxy = 'http://lowercase:8080';
    expect(getChromeProxyArgs()).toEqual(['--proxy-server=https=http://lowercase:8080']);
  });

  it('builds a scheme-qualified Chrome proxy-server flag for a single configured var', () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:46271';
    expect(getChromeProxyArgs()).toEqual(['--proxy-server=https=http://127.0.0.1:46271']);
  });

  it('maps HTTP_PROXY and HTTPS_PROXY to their own scheme in the Chrome flag', () => {
    process.env.HTTP_PROXY = 'http://http-proxy:8080';
    process.env.HTTPS_PROXY = 'http://https-proxy:8443';
    expect(getChromeProxyArgs()).toEqual([
      '--proxy-server=http=http://http-proxy:8080;https=http://https-proxy:8443',
    ]);
  });

  it('expands a NO_PROXY entry into exact-and-subdomain bypass rules for Chrome', () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:46271';
    process.env.NO_PROXY = 'localhost,example.com';
    expect(getChromeProxyArgs()).toEqual([
      '--proxy-server=https=http://127.0.0.1:46271',
      '--proxy-bypass-list=localhost,*.localhost,example.com,*.example.com',
    ]);
  });

  it('returns no Chrome flags when no proxy is configured', () => {
    process.env.NO_PROXY = 'localhost';
    expect(getChromeProxyArgs()).toEqual([]);
  });

  it('rebuilds the dispatcher when the proxy env changes instead of returning a stale one', () => {
    process.env.HTTPS_PROXY = 'http://first-proxy:8080';
    const first = getProxyDispatcher();
    process.env.HTTPS_PROXY = 'http://second-proxy:8080';
    const second = getProxyDispatcher();
    expect(second).not.toBe(first);
  });

  it('reuses the cached dispatcher when the proxy env is unchanged', () => {
    process.env.HTTPS_PROXY = 'http://stable-proxy:8080';
    const first = getProxyDispatcher();
    const second = getProxyDispatcher();
    expect(second).toBe(first);
  });

  it('closes the previous dispatcher when rebuilding after a proxy env change', () => {
    process.env.HTTPS_PROXY = 'http://first-proxy:8080';
    const first = getProxyDispatcher()!;
    const closeSpy = vi.spyOn(first, 'close').mockResolvedValue(undefined);

    process.env.HTTPS_PROXY = 'http://second-proxy:8080';
    getProxyDispatcher();

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('does not alias two different proxy configurations to the same cache key', () => {
    // A naive `values.join(' ')` cache key aliases these: with HTTPS_PROXY held fixed, both
    // no_proxy='a'/NO_PROXY='b c' and no_proxy='a b'/NO_PROXY='c' join to the identical string.
    process.env.HTTPS_PROXY = 'http://proxy.example:8080';
    process.env.no_proxy = 'a';
    process.env.NO_PROXY = 'b c';
    const first = getProxyDispatcher();

    process.env.no_proxy = 'a b';
    process.env.NO_PROXY = 'c';
    const second = getProxyDispatcher();

    expect(second).not.toBe(first);
  });
});

describe('getChromeTlsCompatibilityArgs', () => {
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

  it('returns [] when no proxy is configured', () => {
    expect(getChromeTlsCompatibilityArgs()).toEqual([]);
  });

  it('caps Chrome to TLS 1.2 when a proxy is configured', () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:46271';
    expect(getChromeTlsCompatibilityArgs()).toEqual(['--ssl-version-max=tls1.2']);
  });
});

// Cross-checks getCaBundleSpkiHashes' output against the exact openssl pipeline Chromium's docs
// describe for --ignore-certificate-errors-spki-list, independent of the node:crypto APIs the
// implementation uses internally.
function opensslSpkiHash(certPath: string): string {
  const pubkey = execFileSync('openssl', ['x509', '-in', certPath, '-pubkey', '-noout']);
  const der = execFileSync('openssl', ['pkey', '-pubin', '-outform', 'der'], { input: pubkey });
  const digest = execFileSync('openssl', ['dgst', '-sha256', '-binary'], { input: der });
  return execFileSync('openssl', ['enc', '-base64', '-A'], { input: digest })
    .toString('utf8')
    .trim();
}

describe('CA bundle SPKI pinning for Chrome (getCaBundleSpkiHashes / getChromeSpkiArgs)', () => {
  const originalProxyEnv: Record<string, string | undefined> = {};
  const originalCaEnv: Record<string, string | undefined> = {};
  let dir: string;
  let certAPath: string;
  let certBPath: string;
  let expectedHashA: string;
  let expectedHashB: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'bonsai-ca-bundle-'));
    certAPath = join(dir, 'a.pem');
    certBPath = join(dir, 'b.pem');
    for (const [path, cn] of [
      [certAPath, 'bonsai-test-ca-a'],
      [certBPath, 'bonsai-test-ca-b'],
    ] as const) {
      execFileSync('openssl', [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-keyout',
        join(dir, `${cn}.key`),
        '-out',
        path,
        '-days',
        '1',
        '-subj',
        `/CN=${cn}`,
      ]);
    }
    expectedHashA = opensslSpkiHash(certAPath);
    expectedHashB = opensslSpkiHash(certBPath);
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  beforeEach(() => {
    for (const key of ALL_PROXY_ENV_VARS) {
      originalProxyEnv[key] = process.env[key];
      delete process.env[key];
    }
    for (const key of CA_BUNDLE_ENV_VARS) {
      originalCaEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ALL_PROXY_ENV_VARS) {
      if (originalProxyEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalProxyEnv[key];
    }
    for (const key of CA_BUNDLE_ENV_VARS) {
      if (originalCaEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalCaEnv[key];
    }
  });

  it('returns [] when no proxy is configured, even if a CA bundle is present', () => {
    process.env.NODE_EXTRA_CA_CERTS = certAPath;
    expect(getChromeSpkiArgs()).toEqual([]);
  });

  it('returns [] when a proxy is configured but no CA bundle env var points to a real file', () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:9999';
    process.env.NODE_EXTRA_CA_CERTS = join(dir, 'does-not-exist.pem');
    expect(getCaBundleSpkiHashes()).toEqual([]);
    expect(getChromeSpkiArgs()).toEqual([]);
  });

  it('computes the SPKI hash matching the openssl pipeline Chromium documents for the switch', () => {
    process.env.NODE_EXTRA_CA_CERTS = certAPath;
    expect(getCaBundleSpkiHashes()).toEqual([expectedHashA]);
  });

  it('emits --ignore-certificate-errors-spki-list only when a proxy is configured', () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:9999';
    process.env.NODE_EXTRA_CA_CERTS = certAPath;
    expect(getChromeSpkiArgs()).toEqual([`--ignore-certificate-errors-spki-list=${expectedHashA}`]);
  });

  it('hashes every certificate in a multi-cert bundle', () => {
    const bundlePath = join(dir, 'bundle.pem');
    writeFileSync(bundlePath, readFileSync(certAPath, 'utf8') + readFileSync(certBPath, 'utf8'));
    process.env.HTTPS_PROXY = 'http://127.0.0.1:9999';
    process.env.NODE_EXTRA_CA_CERTS = bundlePath;
    const hashes = getCaBundleSpkiHashes();
    expect(new Set(hashes)).toEqual(new Set([expectedHashA, expectedHashB]));
  });

  it('prefers NODE_EXTRA_CA_CERTS over SSL_CERT_FILE and CURL_CA_BUNDLE', () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:9999';
    process.env.NODE_EXTRA_CA_CERTS = certAPath;
    process.env.SSL_CERT_FILE = certBPath;
    expect(getCaBundleSpkiHashes()).toEqual([expectedHashA]);
  });

  it('falls back to SSL_CERT_FILE, then CURL_CA_BUNDLE, when earlier vars are unset', () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:9999';
    process.env.CURL_CA_BUNDLE = certBPath;
    expect(getCaBundleSpkiHashes()).toEqual([expectedHashB]);
  });

  it('returns [] for a bundle file with no parseable certificates', () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:9999';
    const junkPath = join(dir, 'junk.pem');
    writeFileSync(junkPath, 'not a certificate\n');
    process.env.NODE_EXTRA_CA_CERTS = junkPath;
    expect(getCaBundleSpkiHashes()).toEqual([]);
    expect(getChromeSpkiArgs()).toEqual([]);
  });

  it('skips unparsable entries between valid PEM markers without failing the whole bundle', () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:9999';
    const mixedPath = join(dir, 'mixed.pem');
    writeFileSync(
      mixedPath,
      '-----BEGIN CERTIFICATE-----\nbm90LWEtcmVhbC1jZXJ0\n-----END CERTIFICATE-----\n' +
        readFileSync(certAPath, 'utf8')
    );
    process.env.NODE_EXTRA_CA_CERTS = mixedPath;
    expect(getCaBundleSpkiHashes()).toEqual([expectedHashA]);
  });
});
