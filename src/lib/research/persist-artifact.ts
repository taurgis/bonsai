import { writeArtifact } from './storage.js';
import { writeArtifactSecurely, type SecureWriteResult } from './secure-write.js';
import type { StoreRoots } from './store-roots.js';
import type { ResearchArtifact } from './schema.js';

export type ArtifactWriteKind = 'import' | 'fetch' | 'generic';

export interface PersistArtifactResult extends SecureWriteResult {
  dryRun: boolean;
  /** Secret-redirect warning for stderr, or null when no redirect. */
  redirectWarning: string | null;
}

function redirectWarningFor(kind: ArtifactWriteKind, dryRun: boolean, secretLabel: string): string {
  const content =
    kind === 'import' ? 'imported content' : kind === 'fetch' ? 'page content' : 'content';
  const verb = dryRun ? 'would store' : 'stored';
  return `Detected ${secretLabel} in the ${content}; ${verb} in the global cache instead of the project to avoid committing secrets.`;
}

/**
 * Persist (or dry-run preview) an artifact with secret-safe routing. Owns redirect warning copy
 * so fetch/import cannot drift. When `scratchDir` is set (fetch dry-run), also writes a throwaway
 * copy there for downstream extraction while reporting the real would-be `dataDir`.
 */
export function persistArtifact(opts: {
  roots: StoreRoots;
  cacheKey: string;
  artifact: ResearchArtifact;
  dryRun: boolean;
  kind?: ArtifactWriteKind;
  /** Fetch dry-run throwaway directory; real destination still comes from the secure write. */
  scratchDir?: string | null;
}): PersistArtifactResult {
  const kind = opts.kind ?? 'generic';
  const result = writeArtifactSecurely(opts.roots, opts.cacheKey, opts.artifact, {
    dryRun: opts.dryRun,
  });
  if (opts.scratchDir) {
    writeArtifact(opts.scratchDir, opts.cacheKey, opts.artifact);
  }
  return {
    ...result,
    dryRun: opts.dryRun,
    redirectWarning: result.redirected
      ? redirectWarningFor(kind, opts.dryRun, result.secretLabel!)
      : null,
  };
}

/** Cache status string for import JSON envelopes. */
export function importCacheWriteStatus(dryRun: boolean): 'would_import' | 'imported' {
  return dryRun ? 'would_import' : 'imported';
}

/** Config write status strings. */
export function configWriteStatus(
  dryRun: boolean,
  action: 'set' | 'unset'
): 'would_set' | 'set' | 'would_unset' | 'unset' {
  if (action === 'set') return dryRun ? 'would_set' : 'set';
  return dryRun ? 'would_unset' : 'unset';
}

/** Prune status strings. */
export function pruneWriteStatus(dryRun: boolean): 'would_prune' | 'pruned' {
  return dryRun ? 'would_prune' : 'pruned';
}
