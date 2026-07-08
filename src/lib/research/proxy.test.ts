import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isProxyConfigured, getProxyDispatcher, getChromeProxyArgs } from './proxy.js';

const PROXY_ENV_VARS = [
  'HTTPS_PROXY',
  'https_proxy',
  'HTTP_PROXY',
  'http_proxy',
  'NO_PROXY',
  'no_proxy',
];

describe('sandbox proxy detection', () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of PROXY_ENV_VARS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of PROXY_ENV_VARS) {
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

  it('builds Chrome CLI flags pointing at the configured proxy', () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:46271';
    expect(getChromeProxyArgs()).toEqual(['--proxy-server=http://127.0.0.1:46271']);
  });

  it('includes a proxy-bypass-list flag when NO_PROXY is set', () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:46271';
    process.env.NO_PROXY = 'localhost,127.0.0.1';
    expect(getChromeProxyArgs()).toEqual([
      '--proxy-server=http://127.0.0.1:46271',
      '--proxy-bypass-list=localhost,127.0.0.1',
    ]);
  });

  it('returns no Chrome flags when no proxy is configured', () => {
    process.env.NO_PROXY = 'localhost';
    expect(getChromeProxyArgs()).toEqual([]);
  });
});
