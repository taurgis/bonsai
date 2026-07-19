import { colors } from './color.js';
import { formatHumanFields, type HumanField } from './cli-presentation.js';
import { getArtifactPath } from './research/storage.js';

/**
 * Shared URL / cache-key / path header used by status and inspect human output, plus any
 * command-specific extra rows, formatted as label/value lines.
 *
 * @param target - Normalized URL, cache key, and store roots.
 * @param extra - Optional additional label/value rows.
 * @param artifactPath - Optional explicit path; defaults to the write-root artifact path.
 * @returns Formatted human-output lines.
 */
export function formatCacheTargetHeader(
  target: { normalizedUrl: string; cacheKey: string; roots: { writeRoot: string } },
  extra: HumanField[] = [],
  artifactPath?: string
): string[] {
  const path = artifactPath ?? getArtifactPath(target.roots.writeRoot, target.cacheKey);
  return formatHumanFields([
    ['URL', colors.bold(target.normalizedUrl)],
    ['Cache Key', colors.bold(target.cacheKey)],
    ['Cache Path', colors.gray(path)],
    ...extra,
  ]);
}

/** Stderr tip pointing at the fetch shorthand when a URL has no cache entry. */
export function cacheMissHint(cliBin: string, normalizedUrl: string): string {
  return `Cache miss — run: ${cliBin} ${normalizedUrl}`;
}

const BATCH_SEPARATOR_WIDTH = 40;

/** Visual row separator between per-URL blocks in multi-URL human output; null for single URLs. */
export function batchSeparator(multi: boolean): string | null {
  return multi ? '='.repeat(BATCH_SEPARATOR_WIDTH) : null;
}
