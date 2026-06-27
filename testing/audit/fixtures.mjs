/**
 * Reusable audit fixtures: stable URLs, shared workspaces, note files for import.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** URL guaranteed absent from a fresh sandbox cache. */
const CACHE_MISS_URL = 'https://example.com/audit-cache-miss-xyz';

/** Opt-in network-heavy scenarios (remote search, extra live fetches). */
function networkEnabled() {
  return process.env.AUDIT_NETWORK === '1';
}

export function createFixtures(harness) {
  /** Shared cwd + XDG for multi-step flows (import → status → inspect). */
  function createWorkspace() {
    return harness.freshSandbox();
  }

  function writeNote(cwd, filename, body) {
    const path = join(cwd, filename);
    writeFileSync(path, body, 'utf8');
    return path;
  }

  return {
    CACHE_MISS_URL,
    createWorkspace,
    writeNote,
    networkEnabled,
  };
}
