let cached: boolean | undefined;

// GitHub-hosted windows-latest runners have real internet access, but it — and headless Chrome's
// process-spawn latency there — is unreliable enough to make tests gated on this probe flaky:
// across otherwise-identical CI runs of the same commit, the failing test (and failure mode —
// a fetch timeout, a "Timed out waiting for Chrome to start", a subprocess exit-code mismatch)
// differs run to run, the signature of an environment limitation rather than a real bug. Treated
// the same as no internet access rather than chasing per-test timeout bumps; ubuntu-latest already
// exercises these same code paths against the real network on every run.
function isFlakyWindowsCiRunner(): boolean {
  return process.platform === 'win32' && process.env.GITHUB_ACTIONS === 'true';
}

/**
 * Probes real internet access by fetching a well-known page whose body is stable and small.
 * Sandboxed environments (e.g. Claude Code's remote sandbox) restrict egress to an allowlist
 * that excludes arbitrary hosts like example.com, so tests that need real network content use
 * this to skip gracefully — mirroring the existing `findChromePath()` skip-if-unavailable
 * pattern in browser.test.ts — instead of failing on an environment limitation they can't fix.
 */
export async function hasInternetAccess(): Promise<boolean> {
  if (cached !== undefined) return cached;
  if (isFlakyWindowsCiRunner()) return (cached = false);
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
