import { join } from 'node:path';
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  renameSync,
} from 'node:fs';
import { atomicWriteFile } from '../atomic-write.js';
import { parseArtifact, serializeArtifact } from './artifact.js';
import type { ResearchArtifact } from './schema.js';
import { loadIndexedArtifactsForDir } from './artifact-index.js';
import { isResearchFile } from './url.js';

/**
 * Scans a cache directory and maps each valid artifact file through a callback.
 * Return null from the callback to skip an entry; all non-null results are collected.
 * Parse/read errors are swallowed silently, matching the convention in the command layer.
 */
export function scanCacheDir<T>(
  dir: string,
  fn: (artifact: ResearchArtifact, filePath: string) => T | null
): T[] {
  if (!existsSync(dir)) return [];
  const results: T[] = [];
  for (const file of readdirSync(dir)) {
    if (!isResearchFile(file)) continue;
    try {
      const content = readFileSync(join(dir, file), 'utf-8');
      const artifact = parseArtifact(content);
      // parseArtifact defaults unrecognized frontmatter to a valid-looking shell (cache_key: '',
      // status: 'active'), so a foreign or otherwise-garbled *.md file with `---`/`---` fences never
      // throws here — it would otherwise surface as a phantom entry with no usable cache key. Every
      // artifact Bonsai itself writes always has one, so an empty cache_key means "not ours."
      if (!artifact.metadata.cache_key) continue;
      const result = fn(artifact, join(dir, file));
      if (result !== null) results.push(result);
    } catch {}
  }
  return results;
}

/**
 * Returns the absolute file path for a cache key within the data directory.
 * Ensures that the key is simple hex to prevent directory traversal.
 */
export function getArtifactPath(dataDir: string, key: string): string {
  if (!/^[a-f0-9]+$/.test(key)) {
    throw new Error(`Invalid cache key "${key}". Keys must be alphanumeric hex strings.`);
  }
  return join(dataDir, 'research', `${key}.md`);
}

function processFileForLookup(
  file: string,
  dir: string,
  key: string,
  readOnly: boolean
): ResearchArtifact | null {
  // Same file filter as scanCacheDir — superseded/corrupt/tmp archives must not resolve as active.
  if (!isResearchFile(file)) {
    return null;
  }

  const filePath = join(dir, file);
  try {
    const content = readFileSync(filePath, 'utf-8');
    const artifact = parseArtifact(content);

    if (artifact.metadata.cache_key === key && artifact.metadata.status === 'active') {
      return artifact;
    }
  } catch (err) {
    console.warn(
      `Warning: Corrupt research artifact found at "${filePath}": ${(err as Error).message}`
    );
    // Archiving renames the file on disk — a write a read-only/plan-mode lookup (e.g. `status`,
    // `inspect --read-only`) must never perform, even incidentally while diagnosing a corrupt entry.
    if (!readOnly) {
      try {
        const corruptPath = `${filePath}.corrupt.${Date.now()}`;
        renameSync(filePath, corruptPath);
        console.warn(`Archived corrupt artifact to "${corruptPath}"`);
      } catch (archiveErr) {
        console.error(`Failed to archive corrupt artifact: ${(archiveErr as Error).message}`);
      }
    }
  }
  return null;
}

/**
 * Scans the research storage directory, reading metadata of all valid markdown files
 * to find the active artifact for the given cache key with the newest validated_at timestamp.
 * If a corrupt artifact is found, it is skipped and archived as corrupt — unless `readOnly` is set,
 * in which case it is only reported, never renamed on disk.
 */
export function findArtifact(
  dataDir: string,
  key: string,
  readOnly = false
): ResearchArtifact | null {
  const dir = join(dataDir, 'research');
  if (!existsSync(dir)) {
    return null;
  }

  let bestArtifact: ResearchArtifact | null = null;
  let bestValidatedAt = -1;

  const files = readdirSync(dir);
  for (const file of files) {
    const artifact = processFileForLookup(file, dir, key, readOnly);
    if (!artifact) {
      continue;
    }

    const validatedAt = artifact.metadata.validated_at
      ? new Date(artifact.metadata.validated_at).getTime()
      : 0;
    if (validatedAt > bestValidatedAt) {
      bestArtifact = artifact;
      bestValidatedAt = validatedAt;
    }
  }

  return bestArtifact;
}

/**
 * Checks if a cached artifact exists on disk for a given cache key.
 */
export function hasArtifact(dataDir: string, key: string): boolean {
  try {
    return findArtifact(dataDir, key) !== null;
  } catch {
    return false;
  }
}

/**
 * Writes a ResearchArtifact to disk, creating the research storage folder if needed.
 * Writes to a temporary file first, then atomically renames it.
 * Archives the previous artifact if it exists.
 */
export function writeArtifact(dataDir: string, key: string, artifact: ResearchArtifact): void {
  const path = getArtifactPath(dataDir, key);
  const dir = join(dataDir, 'research');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Capture the current artifact before overwriting it, then commit the new content atomically.
  // Archiving is best-effort and happens only after the write succeeds: a read/archive failure
  // never aborts the write, and a failed write never leaves a stray `.superseded` copy.
  let existingContent: string | null = null;
  if (existsSync(path)) {
    try {
      existingContent = readFileSync(path, 'utf-8');
    } catch (err) {
      console.warn(`Warning: failed to read artifact for archiving: ${(err as Error).message}`);
    }
  }

  atomicWriteFile(path, serializeArtifact(artifact));

  if (existingContent !== null) {
    try {
      writeFileSync(join(dir, `${key}.superseded.${Date.now()}.md`), existingContent, 'utf-8');
    } catch (err) {
      console.warn(`Warning: failed to archive superseded artifact: ${(err as Error).message}`);
    }
  }
}

/**
 * Reads and parses a ResearchArtifact from disk using the scan-based lookup.
 */
export function readArtifact(dataDir: string, key: string): ResearchArtifact {
  const artifact = findArtifact(dataDir, key);
  if (!artifact) {
    throw new Error(`Artifact not found for key: ${key}`);
  }
  return artifact;
}

export interface LocatedArtifact {
  artifact: ResearchArtifact;
  /** The data dir the artifact was found in (project or global). */
  dataDir: string;
  /** The artifact's actual file path within that data dir. */
  path: string;
}

/**
 * Looks up a cache key across an ordered list of data dirs (project first, then global),
 * returning the first match along with where it lives. Implements the project→global
 * read fallback: a missing project entry still resolves against the global cache.
 */
export function locateArtifact(
  dataDirs: string[],
  key: string,
  readOnly = false
): LocatedArtifact | null {
  for (const dataDir of dataDirs) {
    const artifact = findArtifact(dataDir, key, readOnly);
    if (artifact) {
      return { artifact, dataDir, path: getArtifactPath(dataDir, key) };
    }
  }
  return null;
}

/**
 * Multi-root variant of {@link scanCacheDir}. Scans the `research/` dir of each data dir in
 * order and deduplicates by cache key so an entry present in an earlier root (project) shadows
 * the same key in a later root (global) — even when the callback filters it out. Composes
 * scanCacheDir so the file-format and read/parse rules stay defined in exactly one place.
 *
 * Pass `persistIndex: false` under read-only/plan mode so listing never creates `.search-index.json`.
 */
export function scanCacheDirs<T>(
  dataDirs: string[],
  fn: (artifact: ResearchArtifact, filePath: string) => T | null,
  options: { persistIndex?: boolean } = {}
): T[] {
  const seen = new Set<string>();
  return dataDirs.flatMap((dataDir) => {
    const researchDir = join(dataDir, 'research');
    const searchable = loadIndexedArtifactsForDir(researchDir, {
      persist: options.persistIndex,
    });
    return searchable
      .map(({ artifact, filePath }) => {
        const key = artifact.metadata.cache_key;
        if (seen.has(key)) return null;
        seen.add(key);
        return fn(artifact, filePath);
      })
      .filter((x): x is T => x !== null);
  });
}
