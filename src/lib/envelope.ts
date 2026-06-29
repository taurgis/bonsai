/** Fields oclif attaches to CLIError that human pretty-print surfaces but JSON mode must mirror. */
export interface CliErrorShape {
  message?: string;
  code?: string;
  suggestions?: string[];
  ref?: string;
}

/** Map oclif parse-time errors to stable Bonsai codes when the throw site did not set one. */
export function stableErrorCodeFrom(err: unknown): string | undefined {
  const e = err as { code?: string; message?: string; constructor?: { name?: string } };
  if (typeof e?.code === 'string' && e.code) return e.code;
  switch (e?.constructor?.name) {
    case 'RequiredArgsError':
      return 'MISSING_ARGUMENT';
    case 'FlagInvalidOptionError':
    case 'ArgInvalidOptionError':
      return 'INVALID_FLAG_VALUE';
    case 'NonExistentFlagsError':
      return 'UNKNOWN_FLAG';
    case 'UnexpectedArgsError':
      return 'UNEXPECTED_ARGUMENT';
  }
  // A flag supplied without its value throws a plain CLIError with no dedicated class to switch on,
  // so it would otherwise reach agents with no stable code. oclif phrases it two ways: "expects a
  // value" for a free-form flag, "expects one of these values: …" for an options-constrained flag.
  if (
    typeof e?.message === 'string' &&
    /^Flag --\S+ expects (a value$|one of these values:)/.test(e.message)
  ) {
    return 'MISSING_FLAG_VALUE';
  }
  return undefined;
}

/** Strip oclif's generic help suffix from JSON stderr — agents already have structured codes. */
export function normalizeCliErrorMessage(message: string): string {
  const suffix = '\nSee more help with --help';
  return message.endsWith(suffix) ? message.slice(0, -suffix.length) : message;
}

export interface EnvelopeParts {
  command: string;
  ok: boolean;
  exitCode: number;
  stderr: string;
  data: unknown;
  /** Stable machine-readable error code when the failure is a CLIError with `code`. */
  code?: string;
  suggestions?: string[];
  ref?: string;
}

/**
 * Formats a CLI error for the JSON envelope `stderr` field — same lines as human pretty-print,
 * without ANSI or the leading "Error:" prefix (the message is already the primary line).
 */
export function formatErrorForJson(err: CliErrorShape): string {
  const lines: string[] = [];
  if (err.message) lines.push(err.message);
  if (err.code) lines.push(`Code: ${err.code}`);
  if (err.suggestions?.length) {
    if (err.suggestions.length === 1) {
      lines.push(`Try this: ${err.suggestions[0]}`);
    } else {
      lines.push('Try this:');
      for (const suggestion of err.suggestions) lines.push(`* ${suggestion}`);
    }
  }
  if (err.ref) lines.push(`Reference: ${err.ref}`);
  return lines.join('\n');
}

/**
 * Builds the standard Bonsai CLI JSON envelope structure.
 * This is the single source of truth for the output envelope schema.
 */
export function buildEnvelope(parts: EnvelopeParts): Record<string, unknown> {
  const envelope: Record<string, unknown> = {
    schemaVersion: 1,
    command: parts.command,
    ok: parts.ok,
    exitCode: parts.exitCode,
    stdout: '',
    stderr: parts.stderr,
    data: parts.data,
  };
  if (parts.code) envelope.code = parts.code;
  if (parts.suggestions?.length) envelope.suggestions = parts.suggestions;
  if (parts.ref) envelope.ref = parts.ref;
  return envelope;
}

/**
 * Formats a JSON envelope to a string with indentation.
 */
export function formatEnvelope(parts: EnvelopeParts): string {
  return JSON.stringify(buildEnvelope(parts), null, 2);
}
