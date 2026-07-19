import { buildCliErrorEnvelope } from './envelope.js';

/** Print the envelope as pretty JSON on stdout (the machine-readable channel). */
function printJsonEnvelope(envelope: Record<string, unknown>): void {
  console.log(JSON.stringify(envelope, null, 2));
}

export interface PreflightExit {
  exitCode: number;
  json: boolean;
  envelope: Record<string, unknown>;
}

/** Print a preflight usage/error result (JSON envelope on stdout, or oclif-style human error) and exit. */
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

/** Command-not-found hook: print JSON error, set exitCode 2, return envelope (no process.exit). */
export function writeCommandNotFoundJson(opts: {
  command: string;
  message: string;
  code: string;
  suggestions?: string[];
}): Record<string, unknown> {
  const envelope = buildCliErrorEnvelope({
    command: opts.command,
    message: opts.message,
    code: opts.code,
    suggestions: opts.suggestions,
  });
  process.exitCode = 2;
  printJsonEnvelope(envelope);
  return envelope;
}
