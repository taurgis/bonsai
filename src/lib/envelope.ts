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

/** oclif wraps custom flag parse failures as `Parsing --name \n\t…\nSee more help with --help`. */
const PARSING_WRAPPER = /^Parsing --\S+ \n\t([\s\S]*?)(?:\nSee more help with --help)?$/;

/**
 * Strip oclif's generic help suffix and the `Parsing --flag` wrapper so agents and humans see the
 * actionable message we threw (e.g. `Limit must be between 1 and 100.`) instead of the wrapper.
 */
export function normalizeCliErrorMessage(message: string): string {
  const wrapped = message.match(PARSING_WRAPPER);
  if (wrapped?.[1]) return wrapped[1];
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

/** Stable CLIError fields for batch failure rows (status/inspect/fetch). */
export function cliErrorFields(
  err: { code?: string; message?: string; suggestions?: string[]; ref?: string },
  fallbackCode = 'INVALID_URL'
): { code: string; message: string; suggestions?: string[]; ref?: string } {
  return {
    code: typeof err.code === 'string' && err.code ? err.code : fallbackCode,
    message: typeof err.message === 'string' ? err.message : String(err),
    suggestions: err.suggestions,
    ref: err.ref,
  };
}

/**
 * Overlay a batch failure onto a success envelope while keeping per-row `data`.
 * Shared by multi-URL status/inspect (CACHE_MISS) and fetch/row errors.
 */
function enrichBatchFailureEnvelope<T>(
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
 * CACHE_MISS overlay. Message wording is fixed so status/inspect cannot drift.
 */
export function enrichCacheMissEnvelope(
  envelope: Record<string, unknown>,
  data: unknown,
  bin: string
): Record<string, unknown> {
  return enrichBatchFailureEnvelope<CacheMissRow>(envelope, data, {
    pick: (row) => {
      const r = row as CacheMissRow | null | undefined;
      return r?.status === 'miss' ? r : null;
    },
    code: 'CACHE_MISS',
    exitCode: 1,
    message: (first, failures) => {
      const url = first.normalizedUrl ?? '';
      return failures.length > 1
        ? `Cache miss for ${url} and ${failures.length - 1} other URLs`
        : `Cache miss for ${url}`;
    },
    suggestions: (failures) =>
      failures.map((m) => `Fetch and cache it first: ${bin} ${m.normalizedUrl}`),
  });
}

/**
 * Per-row `.error` overlay for multi-URL batches (fetch, status, inspect).
 * Keeps prior successes in `data` and surfaces the first row's code/message.
 */
export function enrichRowErrorEnvelope(
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
 * Partial prune unlink failure: candidates remain in `data`, envelope reports the stable code.
 */
export function enrichPrunePartialEnvelope(
  envelope: Record<string, unknown>,
  data: unknown
): Record<string, unknown> {
  if (!isPruneCounts(data)) return envelope;
  if (data.candidateCount <= 0 || data.prunedCount >= data.candidateCount) return envelope;

  const failed = data.candidateCount - data.prunedCount;
  const code = 'PRUNE_PARTIAL_FAILURE';
  const message = `Failed to delete ${failed} of ${data.candidateCount} cache ${failed === 1 ? 'entry' : 'entries'}.`;
  return {
    ...envelope,
    ok: false,
    exitCode: 1,
    code,
    stderr: formatErrorForJson({ message, code }),
  };
}

function isPruneCounts(data: unknown): data is { prunedCount: number; candidateCount: number } {
  if (!data || typeof data !== 'object') return false;
  const d = data as { prunedCount?: unknown; candidateCount?: unknown };
  return typeof d.prunedCount === 'number' && typeof d.candidateCount === 'number';
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
