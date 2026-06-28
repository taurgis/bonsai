/**
 * Whether ANSI color should be emitted, per the clig.dev / no-color.org rules:
 * - `FORCE_COLOR` (set to any value other than an explicit off) forces color on, ignoring detection.
 * - `NO_COLOR` set to a non-empty value disables color, regardless of that value. An empty
 *   `NO_COLOR` is treated as unset (the spec keys off "present and not empty").
 * - `TERM=dumb` cannot render ANSI, so color is disabled.
 * - Otherwise color follows whether stdout is an interactive terminal.
 * See https://clig.dev/#output and https://no-color.org/.
 */
export function isColorEnabled(): boolean {
  if (typeof process === 'undefined' || !process.env) return false;
  const env = process.env;

  const force = env.FORCE_COLOR;
  if (force !== undefined && force !== '' && force !== '0' && force !== 'false') return true;

  if (env.NO_COLOR !== undefined && env.NO_COLOR !== '') return false;

  if (env.TERM === 'dumb') return false;

  return Boolean(process.stdout && process.stdout.isTTY);
}

export function color(text: string, colorCode: string): string {
  if (!isColorEnabled()) return text;
  return `${colorCode}${text}\x1b[0m`;
}

export const colors = {
  bold: (t: string) => color(t, '\x1b[1m'),
  green: (t: string) => color(t, '\x1b[32m'),
  yellow: (t: string) => color(t, '\x1b[33m'),
  red: (t: string) => color(t, '\x1b[31m'),
  cyan: (t: string) => color(t, '\x1b[36m'),
  gray: (t: string) => color(t, '\x1b[90m'),
  magenta: (t: string) => color(t, '\x1b[35m'),
};

function escapeRegex(s: string): string {
  return s.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}

/**
 * Highlights terms matching the query inside the text by wrapping them in yellow and bold ANSI tags.
 */
export function highlightQuery(text: string, queryTerms: string[]): string {
  if (!isColorEnabled() || !queryTerms || queryTerms.length === 0) return text;
  let highlighted = text;
  // Sort terms by length descending to avoid highlighting sub-parts first
  const sortedTerms = [...queryTerms].sort((a, b) => b.length - a.length);
  for (const term of sortedTerms) {
    if (term.length < 3) continue; // avoid highlighting very small words/particles
    const regex = new RegExp(`(${escapeRegex(term)})`, 'gi');
    highlighted = highlighted.replace(regex, '\x1b[1m\x1b[33m$1\x1b[0m');
  }
  return highlighted;
}
