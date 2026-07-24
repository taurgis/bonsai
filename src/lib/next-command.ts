/**
 * Builds a suggested next CLI invocation for a truncated `list`/`search` result — a copy-pasteable
 * command that reproduces the caller's own filters with a raised `--limit`, so the caller never has
 * to guess the syntax for "show me more." Surfaced as `summary.nextCommand` in the JSON/TOON
 * envelope and as a human-mode tip.
 */

// Never valid to suggest back to a caller: `--limit` is being replaced by the new value, and
// `--identity` is a hidden, undocumented flag only ever injected by the bare-invocation argv
// rewrite (see argv.ts) — carrying it into a suggested command would leak an internal detail.
const DROPPED_FLAGS = new Set(['--limit', '--identity']);

// Tokens made only of these characters are safe to print bare in a shell command; anything else
// (spaces, quotes, glob patterns like `*`) is double-quoted so the suggestion stays copy-pasteable.
const SAFE_BARE_TOKEN = /^[A-Za-z0-9_@%+.:,/-]+$/;

function quoteShellArgIfNeeded(token: string): string {
  if (SAFE_BARE_TOKEN.test(token)) return token;
  return `"${token.replace(/(["\\$`])/g, '\\$1')}"`;
}

/**
 * @param bin - The CLI's own binary name (`this.config.bin`).
 * @param commandId - The command to suggest (`list` or `search`).
 * @param argv - The current invocation's raw argv (`this.argv`), reused as-is so the suggestion can
 *   never drift from whatever filters/flags the caller actually passed.
 * @param newLimit - The `--limit` value to suggest.
 * @returns A copy-pasteable shell command string.
 */
export function buildNextLimitCommand(
  bin: string,
  commandId: string,
  argv: readonly string[],
  newLimit: number
): string {
  const kept: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (token === '--limit') {
      i++; // also drop its value
      continue;
    }
    if (token.startsWith('--limit=') || DROPPED_FLAGS.has(token)) continue;
    kept.push(quoteShellArgIfNeeded(token));
  }
  return [bin, commandId, ...kept, '--limit', String(newLimit)].join(' ');
}
