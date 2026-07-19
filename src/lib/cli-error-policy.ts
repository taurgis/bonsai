import {
  formatErrorForJson,
  normalizeCliErrorMessage,
  stableErrorCodeFrom,
  type CliErrorShape,
} from './envelope.js';

/** Process succeeded. */
export const EXIT_OK = 0;
/** Runtime / batch failure (agents treat as failed). */
export const EXIT_RUNTIME_FAILURE = 1;
/** Usage / validation failure (flags, URLs, missing args). */
export const EXIT_USAGE = 2;
/** Stale content served after failed revalidation; success envelope may still be `ok: true`. */
export const EXIT_STALE_SERVED = 5;

/**
 * Resolves the process/envelope exit code from an oclif CLIError or plain Error.
 *
 * @param err - Error-like object with optional `oclif.exit` or `exitCode`.
 * @returns Exit code; defaults to {@link EXIT_RUNTIME_FAILURE}.
 */
export function resolveExitCode(err: { oclif?: { exit?: number }; exitCode?: number }): number {
  return err?.oclif?.exit ?? err?.exitCode ?? EXIT_RUNTIME_FAILURE;
}

/** Default recovery tips when a throw site set a stable code but no suggestions. */
function fallbackSuggestionsForCode(
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

/** Normalized error fields shared by human pretty-print and the `--json` envelope. */
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
 *
 * @param err - Thrown value (Error, CLIError, or unknown).
 * @param options.bin - CLI binary name for help suggestions.
 * @param options.command - Command id for help suggestions.
 * @returns Prepared fields for exit handling and envelope construction.
 */
export function prepareCliError(
  err: unknown,
  options: { bin: string; command: string }
): PreparedCliError {
  const e = err as CliErrorShape & {
    oclif?: { exit?: number };
    exitCode?: number;
    ref?: string;
  };
  const exitCode = resolveExitCode(e);
  const code = stableErrorCodeFrom(e);
  const message = typeof e?.message === 'string' ? normalizeCliErrorMessage(e.message) : undefined;
  const suggestions = e.suggestions?.length
    ? e.suggestions
    : fallbackSuggestionsForCode(code, options.bin, options.command);
  const stderr =
    message || code || suggestions?.length || e?.ref
      ? formatErrorForJson({ ...e, message, code, suggestions })
      : String(err);
  return { exitCode, code, message, suggestions, ref: e.ref, stderr };
}

/**
 * Attach stable code + fallback suggestions onto a mutable error (human pretty-print path).
 *
 * @param err - Mutable error object receiving `code` / `suggestions`.
 * @param options.bin - CLI binary name for help suggestions.
 * @param options.command - Command id for help suggestions.
 */
export function enrichErrorForDisplay(
  err: { code?: string; suggestions?: string[]; message?: string },
  options: { bin: string; command: string }
): void {
  if (!err.code) {
    const code = stableErrorCodeFrom(err);
    if (code) err.code = code;
  }
  if (err.code && !err.suggestions?.length) {
    err.suggestions = fallbackSuggestionsForCode(err.code, options.bin, options.command);
  }
}
