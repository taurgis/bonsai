import {
  formatErrorForJson,
  normalizeCliErrorMessage,
  stableErrorCodeFrom,
  type CliErrorShape,
} from './envelope.js';

/** Exit code from an oclif CLIError or plain Error — shared by process exit and JSON envelope. */
export function exitCodeOf(err: { oclif?: { exit?: number }; exitCode?: number }): number {
  return err?.oclif?.exit ?? err?.exitCode ?? 1;
}

/** Default recovery tips when a throw site set a stable code but no suggestions. */
export function fallbackSuggestionsForCode(
  code: string | undefined,
  bin: string,
  command: string
): string[] | undefined {
  const help = command === bin ? `${bin} --help` : `${bin} ${command} --help`;
  switch (code) {
    case 'UNKNOWN_FLAG':
    case 'INVALID_FLAG_VALUE':
    case 'MISSING_FLAG_VALUE':
    case 'MISSING_ARGUMENT':
    case 'UNEXPECTED_ARGUMENT':
      return [`Check usage: ${help}`];
    case 'INVALID_DURATION':
      return ['Use a whole number plus a unit, e.g. 2h, 7d, or 6m.'];
    default:
      return undefined;
  }
}

export interface PreparedCliError {
  exitCode: number;
  code: string | undefined;
  message: string | undefined;
  suggestions: string[] | undefined;
  ref: string | undefined;
  stderr: string;
}

/**
 * Normalize a thrown value into the fields humans and `--json` both need: stable code,
 * suggestions (including fallbacks), and stderr lines that mirror human pretty-print.
 */
export function prepareCliError(
  err: unknown,
  opts: { bin: string; command: string }
): PreparedCliError {
  const e = err as CliErrorShape & {
    oclif?: { exit?: number };
    exitCode?: number;
    ref?: string;
  };
  const exitCode = exitCodeOf(e);
  const code = stableErrorCodeFrom(e);
  const message = typeof e?.message === 'string' ? normalizeCliErrorMessage(e.message) : undefined;
  const suggestions = e.suggestions?.length
    ? e.suggestions
    : fallbackSuggestionsForCode(code, opts.bin, opts.command);
  const stderr =
    message || code || suggestions?.length || e?.ref
      ? formatErrorForJson({ ...e, message, code, suggestions })
      : String(err);
  return { exitCode, code, message, suggestions, ref: e.ref, stderr };
}

/** Attach stable code + fallback suggestions onto a mutable error (human pretty-print path). */
export function enrichErrorForDisplay(
  err: { code?: string; suggestions?: string[]; message?: string },
  opts: { bin: string; command: string }
): void {
  if (!err.code) {
    const code = stableErrorCodeFrom(err);
    if (code) err.code = code;
  }
  if (err.code && !err.suggestions?.length) {
    err.suggestions = fallbackSuggestionsForCode(err.code, opts.bin, opts.command);
  }
}
