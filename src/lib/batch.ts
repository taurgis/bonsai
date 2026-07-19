import { cliErrorFields } from './envelope.js';
import { EXIT_RUNTIME_FAILURE } from './cli-error-policy.js';

/**
 * Collapse a multi-URL command's per-URL rows into the CLI's single-vs-array return
 * contract, and mark {@link EXIT_RUNTIME_FAILURE} when any row is a failure outcome.
 *
 * @param results - Per-URL result rows.
 * @param isFailure - Predicate marking a row as a failure outcome.
 * @returns The sole row when there is one URL; otherwise the full array.
 */
export function finalizeBatch<T>(results: T[], isFailure: (row: T) => boolean): T | T[] {
  if (results.some(isFailure)) process.exitCode = EXIT_RUNTIME_FAILURE;
  return results.length === 1 ? results[0]! : results;
}

/**
 * status/inspect batch rows: a miss or a validation error row is a failure outcome.
 *
 * @param row - Batch row with a `status` field.
 * @returns `true` when the row should fail the batch exit code.
 */
export function isBatchReadFailure(row: { status: string }): boolean {
  return row.status === 'miss' || row.status === 'error';
}

/**
 * Sparse validation-failure row for multi-URL status/inspect. Only the fields agents need —
 * no fake cacheKey/freshness/metadata padding.
 *
 * @param url - Input URL that failed validation.
 * @param err - Error-like object with optional code/message/suggestions/ref.
 * @returns Sparse error row for the batch result array.
 */
export function urlValidationErrorRow(
  url: string,
  err: { code?: string; message?: string; suggestions?: string[]; ref?: string }
) {
  return {
    status: 'error' as const,
    normalizedUrl: url,
    error: cliErrorFields(err),
  };
}
