import { colors } from './color.js';
import { formatHumanFields, type HumanField } from './cli-presentation.js';
import { getArtifactPath } from './research/storage.js';

/** Shared URL / cache-key / path header used by status and inspect human output. */
export function cacheTargetHeaderFields(
  target: { normalizedUrl: string; cacheKey: string; roots: { writeRoot: string } },
  artifactPath?: string
): HumanField[] {
  const path = artifactPath ?? getArtifactPath(target.roots.writeRoot, target.cacheKey);
  return [
    ['URL', colors.bold(target.normalizedUrl)],
    ['Cache Key', colors.bold(target.cacheKey)],
    ['Cache Path', colors.gray(path)],
  ];
}

/** Header field lines plus any command-specific extras, formatted for human output. */
export function formatCacheTargetHeader(
  target: { normalizedUrl: string; cacheKey: string; roots: { writeRoot: string } },
  extra: HumanField[] = [],
  artifactPath?: string
): string[] {
  return formatHumanFields([...cacheTargetHeaderFields(target, artifactPath), ...extra]);
}

/** Stderr tip pointing at the fetch shorthand when a URL has no cache entry. */
export function cacheMissHint(bin: string, normalizedUrl: string): string {
  return `Cache miss — run: ${bin} ${normalizedUrl}`;
}

const BATCH_SEPARATOR_WIDTH = 40;

/** Visual row separator between per-URL blocks in multi-URL human output; null for single URLs. */
export function batchSeparator(multi: boolean): string | null {
  return multi ? '='.repeat(BATCH_SEPARATOR_WIDTH) : null;
}
