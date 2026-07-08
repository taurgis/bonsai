import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isProxyConfigured,
  getProxyDispatcher,
  getChromeProxyArgs,
  ALL_PROXY_ENV_VARS,
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
});
