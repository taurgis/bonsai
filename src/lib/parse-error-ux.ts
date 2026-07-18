import { normalizeCliErrorMessage } from './envelope.js';
import { closestMatch, maxFuzzyDistance } from './text.js';

type EnrichableError = Error & {
  message: string;
  code?: string;
  suggestions?: string[];
  flags?: string[];
  parse?: { input?: { flags?: Record<string, unknown> } };
};

/** FlagInvalidOptionError / ArgInvalidOptionError body (after help-suffix strip). */
const EXPECTED_OPTION = /^Expected --([^=]+)=(\S+) to be one of: (.+)$/;

/**
 * Closest option value, preferring edit distance then a unique prefix match. Prefix handling covers
 * truncated enums like `stale` → `stale_grace`/`stale_expired` where edit distance alone is too far.
 */
export function closestOptionValue(
  input: string,
  options: readonly string[]
): string | string[] | null {
  const edit = closestMatch(input, options, maxFuzzyDistance(input));
  if (edit) return edit;
  const prefixed = options.filter((option) => option === input || option.startsWith(`${input}_`));
  if (prefixed.length === 1) return prefixed[0]!;
  if (prefixed.length > 1) return prefixed;
  return null;
}

function suggestableFlagNames(err: EnrichableError): string[] {
  const defined = err.parse?.input?.flags;
  if (!defined) return [];
  const names: string[] = [];
  for (const [name, flag] of Object.entries(defined)) {
    names.push(`--${name}`);
    const aliases = (flag as { aliases?: string[] } | undefined)?.aliases;
    if (aliases) {
      for (const alias of aliases) names.push(`--${alias}`);
    }
    const char = (flag as { char?: string } | undefined)?.char;
    if (char) names.push(`-${char}`);
  }
  // Global `--json` is always valid even when the parse snapshot omits it.
  if (!names.includes('--json')) names.push('--json');
  return names;
}

function enrichUnknownFlags(err: EnrichableError): void {
  if (!Array.isArray(err.flags) || err.flags.length === 0) return;
  const candidates = suggestableFlagNames(err);
  if (candidates.length === 0) return;

  const suggestions: string[] = [];
  const lines: string[] = [];
  for (const bad of err.flags) {
    const match = closestMatch(bad, candidates, maxFuzzyDistance(bad.replace(/^-*/, '')));
    if (!match || match === bad) continue;
    lines.push(`Did you mean ${match}?`);
    suggestions.push(match);
  }
  if (lines.length === 0) return;

  err.message = [err.message, ...lines].join('\n');
  err.suggestions = [...(err.suggestions ?? []), ...suggestions];
}

function enrichInvalidOption(err: EnrichableError): void {
  const match = err.message.match(EXPECTED_OPTION);
  if (!match) return;
  const [, flagName, input, optionsCsv] = match;
  if (!flagName || !input || !optionsCsv) return;
  const options = optionsCsv
    .split(', ')
    .map((part) => part.trim())
    .filter(Boolean);

  // `list` deliberately omits `section` children; point callers at inspect instead of a dead end.
  if (flagName === 'artifact-type' && input === 'section') {
    const tip = 'Section artifacts are omitted from list; inspect a page URL to see its sections.';
    err.message = `${err.message}\n${tip}`;
    err.suggestions = [
      ...(err.suggestions ?? []),
      'bonsai inspect <url>',
      'bonsai list --artifact-type source',
    ];
    return;
  }

  const suggestion = closestOptionValue(input, options);
  if (!suggestion) return;
  if (Array.isArray(suggestion)) {
    const joined = suggestion.join(' or ');
    err.message = `${err.message}\nDid you mean ${joined}?`;
    err.suggestions = [
      ...(err.suggestions ?? []),
      ...suggestion.map((value) => `--${flagName} ${value}`),
    ];
    return;
  }
  err.message = `${err.message}\nDid you mean ${suggestion}?`;
  err.suggestions = [...(err.suggestions ?? []), `--${flagName} ${suggestion}`];
}

/**
 * Improve oclif parse-time errors in place: clean wrapper text, suggest flag/option typos, and add
 * actionable tips for known contract gaps (e.g. list + `--artifact-type section`).
 */
export function enrichParseError(err: EnrichableError): void {
  err.message = normalizeCliErrorMessage(err.message);
  enrichUnknownFlags(err);
  enrichInvalidOption(err);
}
