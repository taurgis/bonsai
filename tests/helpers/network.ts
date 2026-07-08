let cached: boolean | undefined;

/**
 * Probes real internet access by fetching a well-known page whose body is stable and small.
 * Sandboxed environments (e.g. Claude Code's remote sandbox) restrict egress to an allowlist
 * that excludes arbitrary hosts like example.com, so tests that need real network content use
 * this to skip gracefully — mirroring the existing `findChromePath()` skip-if-unavailable
 * pattern in browser.test.ts — instead of failing on an environment limitation they can't fix.
 */
export async function hasInternetAccess(): Promise<boolean> {
  if (cached !== undefined) return cached;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch('https://example.com', { signal: controller.signal });
      const text = await res.text();
      cached = res.ok && text.includes('Example Domain');
    } finally {
      clearTimeout(timer);
    }
  } catch {
    cached = false;
  }
  return cached;
}
