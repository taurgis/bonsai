import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';

/** `which`/`where` lookup for a command name; `null` when not found on `PATH`. */
export function findOnPath(command: string): string | null {
  const finder = process.platform === 'win32' ? 'where' : 'which';
  try {
    const output = execFileSync(finder, [command], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    // `where` on Windows can print multiple matches, one per line; the first is the one PATH resolves to.
    return output.split(/\r?\n/).find((line) => line.trim() !== '') ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolves the command a hook config should invoke to run this CLI (AXI rule: "hook commands
 * should use a PATH-verified binary name when it resolves to the current executable, and fall
 * back to the full absolute path otherwise"). This keeps a global install portable across
 * machines while guaranteeing a hook never silently runs a different `bonsai` than the one that
 * installed it.
 *
 * @param scriptPath - The currently running script (`process.argv[1]`).
 * @param lookup - `PATH` lookup, injectable for tests.
 * @returns `"bonsai"` when `PATH` resolves to this same script, otherwise `node "<absolute path>"`.
 */
export function resolveBinCommand(
  scriptPath: string,
  lookup: typeof findOnPath = findOnPath
): string {
  const realScript = realpathSync(scriptPath);
  const onPath = lookup('bonsai');
  if (onPath) {
    try {
      if (realpathSync(onPath) === realScript) return 'bonsai';
    } catch {
      // onPath didn't resolve to a real file (stale PATH entry) — fall through to the absolute path.
    }
  }
  return `node "${realScript}"`;
}
