export interface EnvelopeParts {
  command: string;
  ok: boolean;
  exitCode: number;
  stderr: string;
  data: unknown;
}

/**
 * Builds the standard Bonsai CLI JSON envelope structure.
 * This is the single source of truth for the output envelope schema.
 */
export function buildEnvelope(parts: EnvelopeParts): Record<string, unknown> {
  return {
    schemaVersion: 1,
    command: parts.command,
    ok: parts.ok,
    exitCode: parts.exitCode,
    stdout: '',
    stderr: parts.stderr,
    data: parts.data,
  };
}

/**
 * Formats a JSON envelope to a string with indentation.
 */
export function formatEnvelope(parts: EnvelopeParts): string {
  return JSON.stringify(buildEnvelope(parts), null, 2);
}
