import { normalizeCliErrorMessage } from './envelope.js';
import { closestMatch, closestOptionValues, maxFuzzyDistance } from './text.js';

type FlagMeta = { aliases?: string[]; char?: string };

type EnrichableError = Error & {
  message: string;
  suggestions?: string[];
  flags?: string[];
  parse?: { input?: { flags?: Record<string, FlagMeta> } };
};

/** FlagInvalidOptionError body after {@link normalizeCliErrorMessage}. */
const EXPECTED_OPTION = /^Expected --([^=]+)=(\S+) to be one of: (.+)$/;

function appendSuggestions(err: EnrichableError, lines: string[], suggestions: string[]): void {
  if (lines.length === 0) return;
  err.message = [err.message, ...lines].join('\n');
  err.suggestions = [...(err.suggestions ?? []), ...suggestions];
}

function suggestableFlagNames(err: EnrichableError): string[] {
  const defined = err.parse?.input?.flags;
  if (!defined) return [];
  const names: string[] = [];
  for (const [name, flag] of Object.entries(defined)) {
    names.push(`--${name}`);
    for (const alias of flag.aliases ?? []) names.push(`--${alias}`);
    if (flag.char) names.push(`-${flag.char}`);
  }
  if (!names.includes('--json')) names.push('--json');
  return names;
}

function enrichUnknownFlags(err: EnrichableError): void {
  if (!err.flags?.length) return;
  const candidates = suggestableFlagNames(err);
  if (candidates.length === 0) return;

  const lines: string[] = [];
  const suggestions: string[] = [];
  for (const bad of err.flags) {
    const match = closestMatch(bad, candidates, maxFuzzyDistance(bad.replace(/^-*/, '')));
    if (!match || match === bad) continue;
    lines.push(`Did you mean ${match}?`);
    suggestions.push(match);
  }
  appendSuggestions(err, lines, suggestions);
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
  const values = closestOptionValues(input, options);
  if (values.length === 0) return;

  appendSuggestions(
    err,
    [`Did you mean ${values.join(' or ')}?`],
    values.map((value) => `--${flagName} ${value}`)
  );
}

/**
 * Improve oclif parse-time errors in place: unwrap wrapper text, then suggest flag/option typos.
 * No-op for non-Error throws (e.g. a bare string) — those have no `message` to enrich.
 */
export function enrichParseError(err: EnrichableError): void {
  if (typeof err?.message !== 'string') return;
  err.message = normalizeCliErrorMessage(err.message);
  enrichUnknownFlags(err);
  enrichInvalidOption(err);
}
