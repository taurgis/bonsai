import { buildEnvelope, buildCliErrorEnvelope } from './envelope.js';

export interface JsonEmitOptions {
  command: string;
  ok: boolean;
  exitCode: number;
  stderr: string;
  data?: unknown;
  code?: string;
  suggestions?: string[];
  ref?: string;
}

/**
 * Single stdout/stderr writer for machine JSON envelopes. Used by BaseCommand.toErrorJson,
 * preflight exits in bin/cli.mjs, and the command-not-found hook so routing cannot drift.
 */
export function emitJsonEnvelope(parts: JsonEmitOptions): Record<string, unknown> {
  const envelope = buildEnvelope({
    command: parts.command,
    ok: parts.ok,
    exitCode: parts.exitCode,
    stderr: parts.stderr,
    data: parts.data ?? null,
    code: parts.code,
    suggestions: parts.suggestions,
    ref: parts.ref,
  });
  if (parts.stderr) process.stderr.write(`${parts.stderr}\n`);
  // Callers that already print (oclif toErrorJson) pass printStdout: false via omit —
  // default prints for preflight/hook paths.
  return envelope;
}

export function printJsonEnvelope(envelope: Record<string, unknown>): void {
  console.log(JSON.stringify(envelope, null, 2));
}

export interface PreflightExit {
  exitCode: number;
  json: boolean;
  envelope: Record<string, unknown>;
}

/** Print a preflight usage/error result (JSON or human) and exit the process. */
export function exitWithPreflight(result: PreflightExit): never {
  process.exitCode = result.exitCode;
  const message = String(result.envelope.stderr ?? '');
  if (result.json) {
    if (message) console.error(message);
    printJsonEnvelope(result.envelope);
  } else if (message) {
    console.error(` ›   Error: ${message.replaceAll('\n', '\n ›   ')}`);
  }
  process.exit();
}

/** Build + emit a JSON error from the command-not-found hook (always usage exit 2). */
export function emitCommandNotFoundJson(opts: {
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
  if (envelope.stderr) process.stderr.write(`${String(envelope.stderr)}\n`);
  printJsonEnvelope(envelope);
  return envelope;
}
