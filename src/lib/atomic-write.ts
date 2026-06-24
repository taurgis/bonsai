import { writeFileSync, renameSync, unlinkSync, existsSync } from 'node:fs';

/**
 * Writes `content` to `dest` atomically: write a sibling temp file, then rename it into place.
 * `rename(2)` is atomic on the same filesystem, so a reader never sees a half-written file. The temp
 * lives in `dest`'s directory so the rename never crosses a mount boundary (which would fail EXDEV),
 * and the unique suffix keeps two rapid writers to the same `dest` from clobbering each other's temp.
 * The temp file is cleaned up if the rename throws.
 */
export function atomicWriteFile(dest: string, content: string): void {
  const tmp = `${dest}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}.tmp`;
  try {
    writeFileSync(tmp, content, 'utf-8');
    renameSync(tmp, dest);
  } catch (err) {
    // A failed temp write or rename must not leave the half-written temp behind.
    if (existsSync(tmp)) {
      try {
        unlinkSync(tmp);
      } catch {}
    }
    throw err;
  }
}
