/** Shared assertions for manual CLI audit scenarios. */
import { readFileSync, writeFileSync } from 'node:fs';

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
