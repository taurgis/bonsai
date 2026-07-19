import { buildCliErrorEnvelope } from './envelope.js';
import { EXIT_USAGE } from './cli-error-policy.js';

const JSON_STDOUT_INDENT = 2;

/** Print the envelope as pretty JSON on stdout (the machine-readable channel). */
function printJsonEnvelope(envelope: Record<string, unknown>): void {
  console.log(JSON.stringify(envelope, null, JSON_STDOUT_INDENT));
}

/** Preflight early-exit payload used before oclif command dispatch. */
export interface PreflightExit {
  exitCode: number;
  json: boolean;
  envelope: Record<string, unknown>;
}

/**
 * Print a preflight usage/error result (JSON envelope on stdout, or oclif-style human error) and exit.
 *
 * @param result - Exit code, JSON mode, and envelope to print.
 * @returns Never — calls `process.exit()`.
 */
export function exitWithPreflight(result: PreflightExit): never {
  process.exitCode = result.exitCode;
  const message = String(result.envelope.stderr ?? '');
  if (result.json) {
    printJsonEnvelope(result.envelope);
  } else if (message) {
    console.error(` ›   Error: ${message.replaceAll('\n', '\n ›   ')}`);
  }
  process.exit();
}

/**
 * Command-not-found hook: print JSON error, set {@link EXIT_USAGE}, return envelope (no process.exit).
 *
 * @param options.command - Command id for the envelope.
 * @param options.message - Human-readable error message.
 * @param options.code - Stable error code.
 * @param options.suggestions - Optional recovery tips.
 * @returns The printed error envelope.
 */
export function writeCommandNotFoundJson(options: {
  command: string;
  message: string;
  code: string;
  suggestions?: string[];
}): Record<string, unknown> {
  const envelope = buildCliErrorEnvelope({
    command: options.command,
    message: options.message,
    code: options.code,
    suggestions: options.suggestions,
  });
  process.exitCode = EXIT_USAGE;
  printJsonEnvelope(envelope);
  return envelope;
}
