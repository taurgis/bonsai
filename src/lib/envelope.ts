/** Fields oclif attaches to CLIError that human pretty-print surfaces but JSON mode must mirror. */
export interface CliErrorShape {
  message?: string;
  code?: string;
  suggestions?: string[];
  ref?: string;
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
