import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { writeArtifact, getArtifactPath } from './storage.js';
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
 * Archive then remove an active project artifact so a redirected global copy is not shadowed by
 * project→global lookup order. Best-effort: a failed archive/unlink never undoes the global write.
 *
 * @see https://nodejs.org/api/fs.html#fsunlinksyncpath
 */
function clearProjectArtifactAfterRedirect(projectRoot: string, key: string): void {
  const path = getArtifactPath(projectRoot, key);
  if (!existsSync(path)) return;
  try {
    const content = readFileSync(path, 'utf-8');
    const dir = join(projectRoot, 'research');
    writeFileSync(join(dir, `${key}.superseded.${Date.now()}.md`), content, 'utf-8');
    unlinkSync(path);
  } catch (err) {
    console.warn(
      `Warning: failed to clear project artifact after secret redirect: ${(err as Error).message}`
    );
  }
}

/**
 * Write an artifact to the configured write root, except when it contains a secret and the
 * target is a (potentially committed) project cache — those are redirected to the global cache.
 * Returns where it landed so the caller can warn the user and report the real path.
 *
 * `dryRun` still runs the secret scan and reports the real would-be destination, but skips the
 * actual `writeArtifact` persist — so a read-only preview never gives a falsely reassuring answer
 * about where secret-bearing content would land.
 *
 * On redirect, any existing project copy is archived and removed so lookup cannot keep serving the
 * project shadow after the secret-bearing content moved to global (revalidation parity with
 * first-time project writes — see #90 / AUDIT_71_FINAL).
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

  if (!options.dryRun) {
    writeArtifact(dataDir, key, artifact);
    if (secretLabel) clearProjectArtifactAfterRedirect(roots.writeRoot, key);
  }

  return { dataDir, redirected: Boolean(secretLabel), secretLabel };
}
