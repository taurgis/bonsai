import { deriveCacheKey } from './cache-key.js';
import { locateArtifact, type LocatedArtifact } from './storage.js';
import { loadStoreRoots, type StoreRoots } from './store-roots.js';
import { normalizeUrl } from './url.js';
import type { StorageMode } from '../config/index.js';

export interface ResolveResearchTargetOptions {
  configDir: string | undefined;
  cwd: string;
  dataDir: string;
  flagOverride?: StorageMode;
  lookup?: boolean;
  url: string;
}

export interface ResolvedResearchTarget {
  cacheKey: string;
  located: LocatedArtifact | null;
  normalizedUrl: string;
  roots: StoreRoots;
}

export function resolveResearchTarget(opts: ResolveResearchTargetOptions): ResolvedResearchTarget {
  const normalizedUrl = normalizeUrl(opts.url);
  const cacheKey = deriveCacheKey(normalizedUrl);
  const roots = loadStoreRoots({
    configDir: opts.configDir,
    cwd: opts.cwd,
    dataDir: opts.dataDir,
    flagOverride: opts.flagOverride,
  });
  return {
    cacheKey,
    located: opts.lookup === false ? null : locateArtifact(roots.readRoots, cacheKey),
    normalizedUrl,
    roots,
  };
}
