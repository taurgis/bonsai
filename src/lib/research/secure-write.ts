import { writeArtifact } from './storage.js';
import { scanArtifactForSecret } from './secret-scan.js';
import type { StoreRoots } from './store-roots.js';
import type { ResearchArtifact } from './schema.js';

export interface SecureWriteResult {
  /** Data dir the artifact was actually written to. */
  dataDir: string;
  /** True when a project-bound write was redirected to global because of a detected secret. */
  redirected: boolean;
  /** Label of the detected secret type when redirected, otherwise null. Never the secret value. */
  secretLabel: string | null;
}

/**
 * Write an artifact to the configured write root, except when it contains a secret and the
 * target is a (potentially committed) project cache — those are redirected to the global cache.
 * Returns where it landed so the caller can warn the user and report the real path.
 *
 * `dryRun` still runs the secret scan and reports the real would-be destination, but skips the
 * actual `writeArtifact` persist — so a read-only preview never gives a falsely reassuring answer
 * about where secret-bearing content would land.
 */
export function writeArtifactSecurely(
  roots: StoreRoots,
  key: string,
  artifact: ResearchArtifact,
  options: { dryRun?: boolean } = {}
): SecureWriteResult {
  const isProjectWrite = roots.writeRoot !== roots.globalRoot;
  const secretLabel = isProjectWrite ? scanArtifactForSecret(artifact) : null;
  const dataDir = secretLabel ? roots.globalRoot : roots.writeRoot;

  if (!options.dryRun) writeArtifact(dataDir, key, artifact);

  return { dataDir, redirected: Boolean(secretLabel), secretLabel };
}
