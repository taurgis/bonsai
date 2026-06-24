import { join } from 'node:path';
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  unlinkSync,
  renameSync,
} from 'node:fs';
import { parseArtifact, serializeArtifact } from './artifact.js';
import type { ResearchArtifact } from './schema.js';

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

function processFileForLookup(file: string, dir: string, key: string): ResearchArtifact | null {
  if (!file.endsWith('.md') || file.includes('.tmp')) {
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
    try {
      const corruptPath = `${filePath}.corrupt.${Date.now()}`;
      renameSync(filePath, corruptPath);
      console.warn(`Archived corrupt artifact to "${corruptPath}"`);
    } catch (archiveErr) {
      console.error(`Failed to archive corrupt artifact: ${(archiveErr as Error).message}`);
    }
  }
  return null;
}

/**
 * Scans the research storage directory, reading metadata of all valid markdown files
 * to find the active artifact for the given cache key with the newest validated_at timestamp.
 * If a corrupt artifact is found, it is skipped and archived as corrupt.
 */
export function findArtifact(dataDir: string, key: string): ResearchArtifact | null {
  const dir = join(dataDir, 'research');
  if (!existsSync(dir)) {
    return null;
  }

  let bestArtifact: ResearchArtifact | null = null;
  let bestValidatedAt = -1;

  const files = readdirSync(dir);
  for (const file of files) {
    const artifact = processFileForLookup(file, dir, key);
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

  const tmpPath = `${path}.${Date.now()}.${Math.random().toString(36).substring(2, 7)}.tmp`;
  const content = serializeArtifact(artifact);

  writeFileSync(tmpPath, content, 'utf-8');

  try {
    if (existsSync(path)) {
      try {
        const existingContent = readFileSync(path, 'utf-8');
        const archivePath = join(dir, `${key}.superseded.${Date.now()}.md`);
        writeFileSync(archivePath, existingContent, 'utf-8');
      } catch (err) {
        console.warn(`Warning: failed to archive superseded artifact: ${(err as Error).message}`);
      }
    }
    renameSync(tmpPath, path);
  } catch (err) {
    if (existsSync(tmpPath)) {
      try {
        unlinkSync(tmpPath);
      } catch {}
    }
    throw err;
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
