export function isColorEnabled(): boolean {
  const hasNoColor =
    typeof process !== 'undefined' &&
    process.env &&
    (process.env.NO_COLOR === '1' ||
      process.env.NO_COLOR === 'true' ||
      process.env.NO_COLOR === '');
  const hasForceColor =
    typeof process !== 'undefined' &&
    process.env &&
    (process.env.FORCE_COLOR === '1' || process.env.FORCE_COLOR === 'true');
  const isTTY = typeof process !== 'undefined' && process.stdout && process.stdout.isTTY;

  return !!hasForceColor || (!!isTTY && !hasNoColor);
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
