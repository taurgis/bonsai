import { normalizeCliErrorMessage } from './envelope.js';
import { closestMatch, closestOptionValues, maxFuzzyDistance } from './text.js';

type FlagMeta = { aliases?: string[]; char?: string };

/** oclif parse errors we can enrich — duck-typed after a runtime guard. */
type EnrichableError = {
  message: string;
  suggestions?: string[];
  flags?: string[];
  parse?: { input?: { flags?: Record<string, FlagMeta> } };
};

/** FlagInvalidOptionError body after {@link normalizeCliErrorMessage}. */
const EXPECTED_OPTION = /^Expected --([^=]+)=(\S+) to be one of: (.+)$/;

function asEnrichable(err: unknown): EnrichableError | null {
  if (!err || typeof err !== 'object') return null;
  if (typeof (err as { message?: unknown }).message !== 'string') return null;
  return err as EnrichableError;
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
  // enableJsonFlag is framework-level — it may be absent from parse.input.flags.
  if (!names.includes('--json')) names.push('--json');
  return names;
}

function collectTips(err: EnrichableError): { lines: string[]; suggestions: string[] } {
  const lines: string[] = [];
  const suggestions: string[] = [];

  if (err.flags?.length) {
    const candidates = suggestableFlagNames(err);
    for (const bad of err.flags) {
      const match = closestMatch(bad, candidates, maxFuzzyDistance(bad.replace(/^-*/, '')));
      if (!match || match === bad) continue;
      lines.push(`Did you mean ${match}?`);
      suggestions.push(match);
    }
  }

  const option = err.message.match(EXPECTED_OPTION);
  if (option) {
    const [, flagName, input, optionsCsv] = option;
    if (flagName && input && optionsCsv) {
      const options = optionsCsv
        .split(', ')
        .map((part) => part.trim())
        .filter(Boolean);
      const values = closestOptionValues(input, options);
      if (values.length > 0) {
        lines.push(`Did you mean ${values.join(' or ')}?`);
        suggestions.push(...values.map((value) => `--${flagName} ${value}`));
      }
    }
  }

  return { lines, suggestions };
}

/**
 * Improve oclif parse-time errors in place: unwrap wrapper text, then suggest flag/option typos.
 * Accepts `unknown` because `catch` can receive non-Error throws (bare strings, etc.).
 */
export function enrichParseError(err: unknown): void {
  const enrichable = asEnrichable(err);
  if (!enrichable) return;

  enrichable.message = normalizeCliErrorMessage(enrichable.message);
  const { lines, suggestions } = collectTips(enrichable);
  if (lines.length === 0) return;

  enrichable.message = [enrichable.message, ...lines].join('\n');
  enrichable.suggestions = [...(enrichable.suggestions ?? []), ...suggestions];
}
