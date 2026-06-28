import { join } from 'node:path';
import { existsSync, readdirSync, readFileSync, statSync, type Stats } from 'node:fs';
import { atomicWriteFile } from '../atomic-write.js';
import { parseArtifactShallow } from './artifact.js';
import { isResearchFile } from './url.js';
import type { ResearchArtifact } from './schema.js';

// Sidecar index that caches the lightweight (metadata + summary + compressed) view of each artifact
// so repeat searches avoid re-reading and re-parsing every file. It is a derived cache only: a stale
// or missing index never changes results, because each entry is validated against the file's current
// signature and re-read on any mismatch.

const INDEX_FILE = '.search-index.json';
const INDEX_VERSION = 1;

interface IndexEntry {
  /** Change-detection signature for the source file: `${mtimeMs}:${size}:${ino}`. */
  sig: string;
  /** Shallow-parsed artifact (detailed/provenance intentionally empty). */
  artifact: ResearchArtifact;
}

interface IndexFile {
  version: number;
  /** Keyed by file basename within the research dir. */
  entries: Record<string, IndexEntry>;
}

export interface SearchableArtifact {
  artifact: ResearchArtifact;
  filePath: string;
}

// The repo writes artifacts via temp-file + rename, so every rewrite yields a new inode. Combining
// mtime + size + ino makes any change a guaranteed cache miss even when filesystem mtime resolution
// is coarse (HFS+/FAT) and a same-size edit lands within the same timestamp tick.
function fileSignature(stat: Stats): string {
  return `${stat.mtimeMs}:${stat.size}:${stat.ino}`;
}

function loadIndex(indexPath: string): IndexFile {
  try {
    const parsed = JSON.parse(readFileSync(indexPath, 'utf-8'));
    if (parsed && parsed.version === INDEX_VERSION && parsed.entries) {
      return parsed as IndexFile;
    }
  } catch {
    // Missing or corrupt index: start fresh and rebuild.
  }
  return { version: INDEX_VERSION, entries: {} };
}

function getOrUpdateIndexEntry(
  filePath: string,
  cached: IndexEntry | undefined,
  onChanged: () => void
): IndexEntry | undefined {
  let sig: string;
  try {
    sig = fileSignature(statSync(filePath));
  } catch {
    return undefined;
  }

  if (cached && cached.sig === sig) {
    return cached;
  }

  try {
    const entry = { sig, artifact: parseArtifactShallow(readFileSync(filePath, 'utf-8')) };
    onChanged();
    return entry;
  } catch {
    return undefined;
  }
}

/**
 * Returns the searchable view of every active artifact in one research dir, using the sidecar index
 * to skip unchanged files. Re-reads only files whose signature changed, then persists the refreshed
 * index (best-effort; a write failure never breaks search). Corrupt/unreadable files are skipped —
 * the real read paths in storage.ts handle archiving them.
 */
export function loadSearchableArtifactsForDir(researchDir: string): SearchableArtifact[] {
  if (!existsSync(researchDir)) return [];

  const indexPath = join(researchDir, INDEX_FILE);
  const previous = loadIndex(indexPath);
  const entries: Record<string, IndexEntry> = {};
  const results: SearchableArtifact[] = [];
  let changed = false;

  for (const file of readdirSync(researchDir)) {
    if (!isResearchFile(file)) continue;
    const filePath = join(researchDir, file);

    const entry = getOrUpdateIndexEntry(filePath, previous.entries[file], () => {
      changed = true;
    });

    if (entry) {
      entries[file] = entry;
      results.push({ artifact: entry.artifact, filePath });
    }
  }

  // Files removed since the last run leave dangling entries; drop them so the index can't grow
  // without bound.
  if (!changed) {
    changed = Object.keys(previous.entries).some((key) => !(key in entries));
  }

  if (changed) {
    try {
      atomicWriteFile(indexPath, JSON.stringify({ version: INDEX_VERSION, entries }));
    } catch {
      // Best-effort cache write; search results are already computed without it.
    }
  }

  return results;
}

/**
 * Multi-root variant: scans the `research/` dir of each data dir in order and deduplicates by cache
 * key so a project entry shadows the same key in the global cache. Mirrors the dedup semantics of
 * {@link scanCacheDirs} but reads through the per-root sidecar index.
 */
export function loadSearchableArtifacts(dataDirs: string[]): SearchableArtifact[] {
  const seen = new Set<string>();
  const all: SearchableArtifact[] = [];
  for (const dataDir of dataDirs) {
    for (const located of loadSearchableArtifactsForDir(join(dataDir, 'research'))) {
      const key = located.artifact.metadata.cache_key;
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(located);
    }
  }
  return all;
}
