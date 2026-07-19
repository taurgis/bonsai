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

/** Print the envelope as pretty JSON on stdout (the machine-readable channel). */
export function printJsonEnvelope(envelope: Record<string, unknown>): void {
  console.log(JSON.stringify(envelope, null, 2));
}

/**
 * For BaseCommand.toErrorJson: return the envelope object (oclif prints it to stdout).
 * Error text lives in `envelope.stderr` only — process stderr stays clean under `--json`,
 * matching CACHE_MISS / batch overlays and oclif JSON log suppression.
 */
export function writeJsonErrorStderr(parts: JsonEnvelopeParts): Record<string, unknown> {
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
