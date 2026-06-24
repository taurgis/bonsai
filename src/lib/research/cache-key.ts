import { createHash } from 'node:crypto';
import { normalizeUrl } from './url.js';

/**
 * Derives a deterministic hexadecimal SHA-256 cache key from a source URL.
 * Normalizes the URL first before hashing.
 */
export function deriveCacheKey(url: string): string {
  const normalized = normalizeUrl(url);
  return createHash('sha256').update(normalized).digest('hex');
}
