import { describe, it, expect } from 'vitest';
import { normalizeUrl, isSafeIp } from './url.js';

describe('url validation and normalization', () => {
  it('normalizes protocol casing, default ports, and strips fragments', () => {
    expect(normalizeUrl('HTTPS://Example.com')).toBe('https://example.com/');
    expect(normalizeUrl('https://example.com:443/docs#install')).toBe('https://example.com/docs');
    expect(normalizeUrl('http://example.com:80/docs')).toBe('http://example.com/docs');
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
});
