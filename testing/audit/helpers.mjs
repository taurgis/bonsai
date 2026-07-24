/** Shared assertions for manual CLI audit scenarios. */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Back-date a cached artifact's `validated_at` (and `fetched_at` when present) so freshness/age
 * filters (status, prune) see it as aged, without needing a real fetch/revalidation round trip.
 */
export function ageArtifact(path, isoTimestamp) {
  const content = readFileSync(path, 'utf8');
  const aged = content
    .replace(/^validated_at: .*$/m, `validated_at: ${isoTimestamp}`)
    .replace(/^fetched_at: .*$/m, `fetched_at: ${isoTimestamp}`);
  writeFileSync(path, aged, 'utf8');
}

/** Overwrite a cached artifact with content that fails frontmatter parsing (no `---` fences). */
export function corruptArtifact(path) {
  writeFileSync(path, 'no frontmatter fence at all\njust garbage', 'utf8');
}

/**
 * Undo oclif's own terminal-width word-wrapping of `Errors.warn()` output so an assertion on a long
 * human-mode warning can match it as one continuous sentence (the message itself is unwrapped and
 * correct; only its on-screen rendering varies by width). oclif re-prefixes every wrapped line —
 * including the first — with a continuation bullet (`›` on most terminals, `»` observed on Windows
 * CI), so a plain whitespace collapse alone would leave that marker embedded mid-sentence; strip
 * either per line before rejoining.
 */
export function flattenWhitespace(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*[›»]\s*/, ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Whether the artifact's cache directory contains a `.corrupt.<timestamp>` archive sibling. */
export function hasArchivedCorruptSibling(path) {
  return readdirSync(dirname(path)).some((f) => f.includes('.corrupt.'));
}

/**
 * Drop an unrelated corrupt `*.md` file into the same cache directory as `path`, without touching
 * `path` itself. A cache lookup scans every file in the directory while resolving its own key, so
 * this exercises the "unrelated corrupt sibling" case distinct from corrupting the looked-up entry.
 */
export function seedUnrelatedCorruptSibling(path) {
  const siblingPath = join(dirname(path), 'audit-unrelated-corrupt.md');
  writeFileSync(siblingPath, 'no frontmatter fence at all\njust garbage', 'utf8');
  return siblingPath;
}

export function expectNonIntegerLimitInvalid({ run, expect, parseJson }, commandArgs) {
  const r = run([...commandArgs, '--limit', 'abc', '--json']);
  expect(r.exitCode === 2, `exit ${r.exitCode}`);
  const env = parseJson(r.stdout);
  expect(env?.code === 'INVALID_LIMIT', env?.code);
  expect(env?.stderr?.includes('Code: INVALID_LIMIT'), env?.stderr);
}

export function expectSingleCachedHit({ run, expect, parseJson }, commandArgs, ws, url) {
  const r = run(commandArgs, { cwd: ws.cwd, xdg: ws.xdg });
  const env = parseJson(r.stdout);
  expect(r.exitCode === 0, `exit ${r.exitCode}`);
  expect(env?.data?.length === 1, `results ${env?.data?.length}`);
  expect(env?.data?.[0]?.sourceUrls?.includes(url), JSON.stringify(env?.data?.[0]));
}
