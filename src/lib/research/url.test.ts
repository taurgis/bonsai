import { describe, it, expect } from 'vitest';
import { normalizeUrl, isSafeIp } from './url.js';

describe('url validation and normalization', () => {
  it('normalizes protocol casing, default ports, and strips fragments', () => {
    expect(normalizeUrl('HTTPS://Example.com')).toBe('https://example.com/');
    expect(normalizeUrl('https://example.com:443/docs#install')).toBe('https://example.com/docs');
    expect(normalizeUrl('http://example.com:80/docs')).toBe('http://example.com/docs');
  });

  it('preserves SPA hash routes (Docsify) but strips plain anchors', () => {
    expect(normalizeUrl('https://docsify.js.org/#/configuration')).toBe(
      'https://docsify.js.org/#/configuration'
    );
    expect(normalizeUrl('https://docsify.js.org/#!/guide')).toBe('https://docsify.js.org/#!/guide');
    expect(normalizeUrl('https://example.com/docs#section-2')).toBe('https://example.com/docs');
  });

  it('preserves custom ports and path trailing slashes', () => {
    expect(normalizeUrl('https://example.com:8443/docs/')).toBe('https://example.com:8443/docs/');
    expect(normalizeUrl('https://example.com:8443/docs')).toBe('https://example.com:8443/docs');
  });

  it('lexicographically sorts query parameters', () => {
    expect(normalizeUrl('https://example.com/docs?b=2&a=1')).toBe(
      'https://example.com/docs?a=1&b=2'
    );
    expect(normalizeUrl('https://example.com/docs?a=2&a=1')).toBe(
      'https://example.com/docs?a=1&a=2'
    );
  });

  it('rejects unsupported protocols', () => {
    expect(() => normalizeUrl('ftp://example.com')).toThrow(/Unsupported protocol/);
    expect(() => normalizeUrl('file:///etc/passwd')).toThrow(/Unsupported protocol/);
  });

  it('rejects URLs containing usernames or passwords', () => {
    expect(() => normalizeUrl('https://user:pass@example.com/docs')).toThrow(
      /usernames or passwords/
    );
  });

  it('rejects localhost, loopback, private, and link-local hostnames/IPs', () => {
    expect(() => normalizeUrl('https://localhost/docs')).toThrow(/blocked local target/);
    expect(() => normalizeUrl('https://test.localhost/docs')).toThrow(/blocked local target/);
    expect(() => normalizeUrl('https://127.0.0.1/docs')).toThrow(/blocked local or private target/);
    expect(() => normalizeUrl('https://10.0.0.1/docs')).toThrow(/blocked local or private target/);
    expect(() => normalizeUrl('https://172.16.5.5/docs')).toThrow(
      /blocked local or private target/
    );
    expect(() => normalizeUrl('https://192.168.1.1/docs')).toThrow(
      /blocked local or private target/
    );
    expect(() => normalizeUrl('https://169.254.169.254/docs')).toThrow(
      /blocked local or private target/
    );
    expect(() => normalizeUrl('https://[::1]/docs')).toThrow(/blocked local or private target/);
  });
});

describe('isSafeIp safety check', () => {
  it('correctly classifies loopback, private, and public IPs', () => {
    // Loopback IPv4
    expect(isSafeIp('127.0.0.1')).toBe(false);
    expect(isSafeIp('127.255.0.1')).toBe(false);
    // RFC1918 IPv4
    expect(isSafeIp('10.0.0.1')).toBe(false);
    expect(isSafeIp('172.16.0.1')).toBe(false);
    expect(isSafeIp('172.31.255.255')).toBe(false);
    expect(isSafeIp('192.168.100.1')).toBe(false);
    // Link-local IPv4
    expect(isSafeIp('169.254.1.1')).toBe(false);

    // Public IPv4
    expect(isSafeIp('8.8.8.8')).toBe(true);
    expect(isSafeIp('1.1.1.1')).toBe(true);
    expect(isSafeIp('208.67.222.222')).toBe(true);

    // Loopback/Unspecified IPv6
    expect(isSafeIp('::1')).toBe(false);
    expect(isSafeIp('::')).toBe(false);
    // Link-local IPv6
    expect(isSafeIp('fe80::1')).toBe(false);
    // IPv4-mapped IPv6 loopback/private
    expect(isSafeIp('::ffff:127.0.0.1')).toBe(false);
    expect(isSafeIp('::ffff:10.0.0.1')).toBe(false);

    // Public IPv6
    expect(isSafeIp('2001:4860:4860::8888')).toBe(true);
  });

  it('returns false for strings that are not valid IPs', () => {
    // isIP() returns 0, so neither v4 nor v6 branch runs.
    expect(isSafeIp('not-an-ip')).toBe(false);
    expect(isSafeIp('999.999.999.999')).toBe(false);
    expect(isSafeIp('')).toBe(false);
  });

  it('treats an IPv4-mapped IPv6 with a non-IPv4 tail as public (no v4 reclassification)', () => {
    expect(isSafeIp('::ffff:8.8.8.8')).toBe(true);
    // A ::ffff: prefix whose tail is not a literal IPv4 falls through to the public default.
    expect(isSafeIp('::ffff:0:1')).toBe(true);
  });
});

describe('normalizeUrl invalid input', () => {
  it('throws a descriptive error for an unparseable URL', () => {
    expect(() => normalizeUrl('http://')).toThrow(/Invalid URL/);
    expect(() => normalizeUrl('not a url')).toThrow(/Invalid URL/);
  });

  it('clears the http default port and a custom https port stays', () => {
    expect(normalizeUrl('http://example.com:80/x')).toBe('http://example.com/x');
    expect(normalizeUrl('https://example.com:8443/x')).toBe('https://example.com:8443/x');
  });
});
