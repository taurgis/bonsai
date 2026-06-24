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
 */
export function writeArtifactSecurely(
  roots: StoreRoots,
  key: string,
  artifact: ResearchArtifact
): SecureWriteResult {
  const isProjectWrite = roots.writeRoot !== roots.globalRoot;
  const secretLabel = isProjectWrite ? scanArtifactForSecret(artifact) : null;

  if (secretLabel) {
    writeArtifact(roots.globalRoot, key, artifact);
    return { dataDir: roots.globalRoot, redirected: true, secretLabel };
  }

  writeArtifact(roots.writeRoot, key, artifact);
  return { dataDir: roots.writeRoot, redirected: false, secretLabel: null };
}
