import { join } from 'node:path';
import { loadStorageMode } from '../config/index.js';
import type { StorageMode } from '../config/schema.js';

/**
 * Project-level cache directory name, placed at the current working directory.
 * Storage helpers append `research/` to a data dir, so the on-disk cache for a
 * project lives at `<cwd>/.bonsai/research/`.
 */
export const PROJECT_CACHE_DIRNAME = '.bonsai';

export function projectDataDir(cwd: string): string {
  return join(cwd, PROJECT_CACHE_DIRNAME);
}

export interface StoreRoots {
  mode: StorageMode;
  /** Data dir new artifacts are written to (before secret routing). */
  writeRoot: string;
  /** Global data dir — the safe destination for secret-bearing artifacts. */
  globalRoot: string;
  /** Data dirs to read from, in lookup order. Project first, then global fallback. */
  readRoots: string[];
}

/**
 * Map a resolved storage mode onto concrete data dirs. In project mode, reads fall
 * back to the global cache so a missing project entry still resolves against global.
 */
export function resolveStoreRoots(
  mode: StorageMode,
  oclifDataDir: string,
  cwd: string
): StoreRoots {
  const globalRoot = oclifDataDir;
  if (mode === 'project') {
    const project = projectDataDir(cwd);
    return { mode, writeRoot: project, globalRoot, readRoots: [project, globalRoot] };
  }
  return { mode, writeRoot: globalRoot, globalRoot, readRoots: [globalRoot] };
}

/** Load config (file + env + optional flag) and resolve the concrete store roots. */
export function loadStoreRoots(opts: {
  configDir: string | undefined;
  cwd: string;
  dataDir: string;
  flagOverride?: StorageMode;
}): StoreRoots {
  const mode = loadStorageMode(opts.configDir, opts.cwd, opts.flagOverride);
  return resolveStoreRoots(mode, opts.dataDir, opts.cwd);
}
