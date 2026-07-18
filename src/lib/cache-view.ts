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

export function formatCacheTargetHeader(
  target: { normalizedUrl: string; cacheKey: string; roots: { writeRoot: string } },
  extra: HumanField[] = [],
  artifactPath?: string
): string[] {
  return formatHumanFields([...cacheTargetHeaderFields(target, artifactPath), ...extra]);
}

export function cacheMissHint(bin: string, normalizedUrl: string): string {
  return `Cache miss — run: ${bin} ${normalizedUrl}`;
}

export function batchSeparator(multi: boolean): string | null {
  return multi ? '='.repeat(40) : null;
}
