import { buildEnvelope, buildCliErrorEnvelope } from './envelope.js';

export interface JsonEnvelopeParts {
  command: string;
  ok: boolean;
  exitCode: number;
  stderr: string;
  data?: unknown;
  code?: string;
  suggestions?: string[];
  ref?: string;
}

/** Pure envelope builder — no I/O. */
export function buildJsonEnvelope(parts: JsonEnvelopeParts): Record<string, unknown> {
  return buildEnvelope({
    command: parts.command,
    ok: parts.ok,
    exitCode: parts.exitCode,
    stderr: parts.stderr,
    data: parts.data ?? null,
    code: parts.code,
    suggestions: parts.suggestions,
    ref: parts.ref,
  });
}

export function printJsonEnvelope(envelope: Record<string, unknown>): void {
  console.log(JSON.stringify(envelope, null, 2));
}

/** Write stderr (if any) + stdout JSON, set exitCode, and exit. */
export function writeJsonAndExit(envelope: Record<string, unknown>, exitCode: number): never {
  process.exitCode = exitCode;
  const message = String(envelope.stderr ?? '');
  if (message) process.stderr.write(`${message}\n`);
  printJsonEnvelope(envelope);
  process.exit();
}

/**
 * For BaseCommand.toErrorJson: write error lines to stderr and return the envelope object
 * (oclif prints the return value to stdout).
 */
export function writeJsonErrorStderr(parts: JsonEnvelopeParts): Record<string, unknown> {
  const envelope = buildJsonEnvelope(parts);
  if (parts.stderr) process.stderr.write(`${parts.stderr}\n`);
  return envelope;
}

export interface PreflightExit {
  exitCode: number;
  json: boolean;
  envelope: Record<string, unknown>;
}

/** Print a preflight usage/error result (JSON or human) and exit. */
export function exitWithPreflight(result: PreflightExit): never {
  if (result.json) {
    writeJsonAndExit(result.envelope, result.exitCode);
  }
  process.exitCode = result.exitCode;
  const message = String(result.envelope.stderr ?? '');
  if (message) {
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
  if (envelope.stderr) process.stderr.write(`${String(envelope.stderr)}\n`);
  printJsonEnvelope(envelope);
  return envelope;
}
