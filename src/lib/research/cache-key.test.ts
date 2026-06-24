import { describe, it, expect } from 'vitest';
import { deriveCacheKey } from './cache-key.js';

describe('cache key derivation', () => {
  it('generates a 64-character hex string representing a SHA-256 hash', () => {
    const key = deriveCacheKey('https://example.com/docs');
    expect(key).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces the same cache key for equivalent URLs', () => {
    const key1 = deriveCacheKey('https://example.com:443/docs#some-hash');
    const key2 = deriveCacheKey('HTTPS://EXAMPLE.COM/docs');
    expect(key1).toBe(key2);
  });

  it('produces different cache keys for query parameters order variation but equivalent content', () => {
    const key1 = deriveCacheKey('https://example.com/docs?b=2&a=1');
    const key2 = deriveCacheKey('https://example.com/docs?a=1&b=2');
    expect(key1).toBe(key2);
  });

  it('produces different cache keys for different URLs', () => {
    const key1 = deriveCacheKey('https://example.com/docs');
    const key2 = deriveCacheKey('https://example.com/other');
    expect(key1).not.toBe(key2);
  });
});
