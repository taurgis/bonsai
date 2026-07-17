/**
 * Collapse a multi-URL command's per-URL rows into the CLI's single-vs-array return
 * contract, and mark exit code 1 when any row is a failure outcome.
 */
export function finalizeBatch<T>(results: T[], isFailure: (row: T) => boolean): T | T[] {
  if (results.some(isFailure)) process.exitCode = 1;
  return results.length === 1 ? results[0]! : results;
}
