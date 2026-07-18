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

type CacheMissRow = { status?: string; normalizedUrl?: string };

/**
 * Overlay a batch failure onto a success envelope while keeping per-row `data`.
 * Shared by multi-URL status/inspect (CACHE_MISS) and fetch (FETCH_FAILED).
 */
export function enrichBatchFailureEnvelope<T>(
  envelope: Record<string, unknown>,
  data: unknown,
  opts: {
    /** Return a failure payload for failing rows, or a falsy value to skip. */
    pick: (row: unknown) => T | null | undefined | false;
    code: string | ((first: T, failures: T[]) => string);
    message: (first: T, failures: T[]) => string;
    suggestions?: (failures: T[]) => string[] | undefined;
    ref?: (first: T) => string | undefined;
    exitCode?: number;
  }
): Record<string, unknown> {
  const list = Array.isArray(data) ? data : [data];
  const failures = list.map(opts.pick).filter(Boolean) as T[];
  if (failures.length === 0) return envelope;

  const first = failures[0]!;
  const code = typeof opts.code === 'function' ? opts.code(first, failures) : opts.code;
  const suggestions = opts.suggestions?.(failures);
  const ref = opts.ref?.(first);
  const stderr = formatErrorForJson({
    message: opts.message(first, failures),
    code,
    suggestions,
    ref,
  });
  return {
    ...envelope,
    ok: false,
    exitCode: opts.exitCode ?? 1,
    stderr,
    code,
    suggestions,
    ref,
  };
}

/**
 * CACHE_MISS convenience over {@link enrichBatchFailureEnvelope}.
 * Rows with `status === 'miss'` keep their payloads; the envelope reports the miss.
 */
export function enrichCacheMissEnvelope(
  envelope: Record<string, unknown>,
  data: unknown,
  bin: string,
  messageFor: (normalizedUrl: string, missCount: number) => string
): Record<string, unknown> {
  return enrichBatchFailureEnvelope<CacheMissRow>(envelope, data, {
    pick: (row) => {
      const r = row as CacheMissRow | null | undefined;
      return r?.status === 'miss' ? r : null;
    },
    code: 'CACHE_MISS',
    exitCode: 1,
    message: (first, failures) => messageFor(first.normalizedUrl ?? '', failures.length),
    suggestions: (failures) =>
      failures.map((m) => `Fetch and cache it first: ${bin} ${m.normalizedUrl}`),
  });
}

/**
 * FETCH_FAILED convenience over {@link enrichBatchFailureEnvelope}.
 * Multi-URL fetch keeps prior successes in `data` and surfaces the first row error on the envelope.
 */
export function enrichFetchFailureEnvelope(
  envelope: Record<string, unknown>,
  data: unknown
): Record<string, unknown> {
  return enrichBatchFailureEnvelope<CliErrorShape>(envelope, data, {
    pick: (row) => {
      if (!row || typeof row !== 'object') return null;
      return (row as { error?: CliErrorShape }).error ?? null;
    },
    code: (first) => first.code ?? 'FETCH_FAILED',
    message: (first, failures) =>
      (first.message ?? '') +
      (failures.length > 1 ? `\n…and ${failures.length - 1} other URL failure(s)` : ''),
    suggestions: (failures) => failures[0]?.suggestions,
    ref: (first) => first.ref,
    exitCode: 1,
  });
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
 * Usage/not-found style error envelope: message + Code (+ Try this) in `stderr`, stable `code`,
 * and top-level `suggestions` when present. Shared by argv preflight, help-preflight, and the
 * command_not_found hook so those paths cannot drift.
 */
export function buildCliErrorEnvelope(opts: {
  command: string;
  message: string;
  code: string;
  suggestions?: string[];
  exitCode?: number;
  ref?: string;
}): Record<string, unknown> {
  return buildEnvelope({
    command: opts.command,
    ok: false,
    exitCode: opts.exitCode ?? 2,
    stderr: formatErrorForJson({
      message: opts.message,
      code: opts.code,
      suggestions: opts.suggestions,
      ref: opts.ref,
    }),
    data: null,
    code: opts.code,
    suggestions: opts.suggestions?.length ? opts.suggestions : undefined,
    ref: opts.ref,
  });
}

/**
 * Formats a JSON envelope to a string with indentation.
 */
export function formatEnvelope(parts: EnvelopeParts): string {
  return JSON.stringify(buildEnvelope(parts), null, 2);
}
