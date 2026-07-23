import { Command, Errors, Flags, Interfaces, toConfiguredId, ux } from '@oclif/core';
import { encode } from '@toon-format/toon';
import {
  invalidConfigFileWarnings,
  invalidEnvOverrideWarnings,
  resolveReadOnly,
} from './lib/config/index.js';
import { CLI_FLAG_DESCRIPTIONS } from './lib/cli-presentation.js';
import { formatTip, sanitizeForTerminal } from './lib/text.js';
import {
  enrichErrorForDisplay,
  resolveExitCode,
  prepareCliError,
  EXIT_OK,
  EXIT_STALE_SERVED,
} from './lib/cli-error-policy.js';
import {
  buildEnvelope,
  enrichCacheMissEnvelope,
  enrichRowErrorEnvelope,
  formatErrorForJson,
} from './lib/envelope.js';
import { enrichParseError } from './lib/parse-error-ux.js';
import {
  resolveResearchTarget,
  type ResolveResearchTargetOptions,
  type ResolvedResearchTarget,
} from './lib/research/resolve-target.js';
import { failInvalidUrl, type CliIo } from './lib/research/cli-io.js';

/**
 * Mirrors oclif's own `--json` argv-scan (respecting a `--` pass-through boundary) so `--toon`
 * gets identical treatment: present in argv, regardless of parse state.
 */
function argvHasFlag(argv: string[], flag: string): boolean {
  const passThroughIndex = argv.indexOf('--');
  const flagIndex = argv.indexOf(flag);
  return passThroughIndex === -1
    ? flagIndex !== -1
    : flagIndex !== -1 && flagIndex < passThroughIndex;
}

/**
 * Shared base for every Bonsai command. Enables oclif's native `--json` flag,
 * parses args/flags once in `init()` so commands read `this.args`/`this.flags`
 * directly in `run()`, and wraps `--json` output in the Bonsai envelope via the
 * framework's `toSuccessJson`/`toErrorJson` hooks.
 */
export abstract class BaseCommand<T extends typeof Command> extends Command {
  static enableJsonFlag = true;

  /**
   * Flags shared by every command. Passed as `baseFlags` to `this.parse()` in `init()` below, which
   * is oclif's own mechanism for merging them into `this.ctor.flags` at both parse time and
   * `--help`/manifest generation — no per-command `static flags` changes are needed to expose these.
   * `--plan` mirrors agent-harness "plan mode" terminology; `--read-only` is the canonical name.
   */
  static baseFlags = {
    'read-only': Flags.boolean({
      aliases: ['plan'],
      default: false,
      description: CLI_FLAG_DESCRIPTIONS.readOnly,
    }),
    toon: Flags.boolean({
      default: false,
      description: CLI_FLAG_DESCRIPTIONS.toon,
    }),
  };

  flags!: Interfaces.InferredFlags<T['flags']>;
  args!: Interfaces.InferredArgs<T['args']>;

  public parsedArgv!: string[];

  public override async init(): Promise<void> {
    await super.init();
    const { args, flags, argv } = await this.parse({
      flags: this.ctor.flags,
      baseFlags: this.ctor.baseFlags,
      enableJsonFlag: this.ctor.enableJsonFlag,
      args: this.ctor.args,
      strict: this.ctor.strict,
    });
    this.flags = flags as Interfaces.InferredFlags<T['flags']>;
    this.args = args as Interfaces.InferredArgs<T['args']>;
    this.parsedArgv = argv as string[];

    // --json and --toon both claim the machine-output seat; picking one silently over the other
    // would surprise a caller who set both by mistake, so reject the combination outright. Reuses
    // the existing CONFLICTING_FLAGS code (not a new one) — the catalog already documents it as the
    // one code for "choose one of the mutually exclusive options", regardless of which flags.
    if (this.flags?.['json'] && this.flags?.['toon']) {
      this.error('Cannot combine --json and --toon: pick one output format.', {
        exit: 2,
        code: 'CONFLICTING_FLAGS',
        suggestions: ['Pass only one of --json or --toon'],
      });
    }

    // Surface a set-but-invalid BONSAI_* override once per run. Resolution silently drops such a
    // value, so without this a typo'd env var would take no effect with no signal. Warnings go to
    // stderr (even under --json), so machine output stays clean.
    for (const warning of invalidEnvOverrideWarnings(process.env)) this.warn(warning);
    // Same signal for a corrupted or hand-edited config file: parsing silently degrades to `{}`
    // (or drops just the offending key), which would otherwise mask the problem entirely.
    for (const warning of invalidConfigFileWarnings(
      this.config.configDir,
      process.cwd(),
      this.config.bin
    )) {
      this.warn(warning);
    }
  }

  /**
   * Treat `--toon` as machine mode too, so every existing `!this.jsonEnabled()` human-output branch
   * across every command (table rendering, tips, empty-state guidance) is suppressed under `--toon`
   * for free, exactly as it already is under `--json`.
   */
  public override jsonEnabled(): boolean {
    // Mirrors oclif's own enableJsonFlag guard (every command in this CLI sets it, but the base
    // class's contract shouldn't silently break if a future command ever opts out).
    return (
      super.jsonEnabled() ||
      (Boolean(this.ctor?.enableJsonFlag) && argvHasFlag(this.argv, '--toon'))
    );
  }

  /**
   * Real `--json` keeps oclif's own colorized-JSON rendering untouched (zero regression risk).
   * `--toon` (and no real `--json`) re-encodes the identical envelope as TOON instead — same data,
   * ~40% fewer tokens for callers who opted in.
   */
  protected override logJson(json: unknown): void {
    if (super.jsonEnabled()) {
      super.logJson(json);
      return;
    }
    // this.log() no-ops whenever jsonEnabled() is true (by design, everywhere else in this CLI) —
    // ux.stdout writes directly, matching how oclif's own default logJson bypasses that guard too.
    ux.stdout(encode(json));
  }

  /**
   * Always surface warnings on stderr, even under `--json`. oclif silences `warn()` in JSON mode,
   * but our warnings (secret-redirect, stale-serve, prune failures) are
   * security- and freshness-relevant side effects users must see. stderr never pollutes the stdout
   * JSON envelope, so machine output stays clean.
   */
  public override warn(input: string | Error): string | Error {
    Errors.warn(input);
    return input;
  }

  /**
   * Sanitize the human-readable error surface before handing off to oclif. Error text throughout
   * this CLI routinely echoes raw user input back (a rejected URL, `--ttl`, an unknown config key)
   * so the message stays actionable, but that value is untrusted per the repo's trust-boundary
   * rules — the same reasoning that already strips ANSI/control bytes from cached content before
   * terminal render (see `sanitizeForTerminal`). Left unsanitized, a value containing raw escape
   * bytes would replay as a terminal-injection attack the moment the rejected command's own error
   * is printed. `--json` is untouched: `JSON.stringify` already escapes control characters, and the
   * raw value there preserves exact input for programmatic callers.
   */
  public override error(
    input: string | Error,
    options: { code?: string; exit: false } & Errors.PrettyPrintableError
  ): void;
  public override error(
    input: string | Error,
    options?: { code?: string; exit?: number } & Errors.PrettyPrintableError
  ): never;
  public override error(
    input: string | Error,
    options: { code?: string; exit?: number | false } & Errors.PrettyPrintableError = {}
  ): void | never {
    if (!this.jsonEnabled()) {
      if (typeof input === 'string') input = sanitizeForTerminal(input);
      if (options.suggestions) {
        options = { ...options, suggestions: options.suggestions.map(sanitizeForTerminal) };
      }
    }
    // Nothing in this codebase passes `exit: false` today, but the override must still accept it
    // (oclif's own `error()` does) to stay a valid override of the base Command method. Destructure
    // `exit` into its own binding so narrowing it to the `false` literal actually narrows the object
    // passed to `super.error()` into each of oclif's two overloads — narrowing a property read alone
    // (`options.exit === false`) doesn't narrow the enclosing object's type, only a local variable's.
    const { exit, ...rest } = options;
    if (exit === false) return super.error(input, { ...rest, exit });
    return super.error(input, { ...rest, exit });
  }

  /**
   * Human-mode-only contextual next-step suggestion after a successful command, mirroring the
   * "Try this:" pattern already used on errors. A no-op under `--json`/`--toon`: the envelope's
   * `data` is self-describing, so machine callers get no prose.
   */
  protected tip(message: string): void {
    if (this.jsonEnabled()) return;
    this.warn(formatTip(message));
  }

  /** Whether read-only/plan mode is active for this invocation (flag OR either env var). */
  protected get readOnly(): boolean {
    return resolveReadOnly({ flag: Boolean(this.flags?.['read-only']), env: process.env });
  }

  /**
   * Combines a command's own explicit dry-run intent with global read-only mode. Warns once (on
   * stderr, so it never pollutes `--json`) when read-only mode is what's actually suppressing the
   * write, so a skipped write is never a silent surprise to the caller.
   */
  protected effectiveDryRun(explicitDryRun: boolean): boolean {
    if (this.readOnly && !explicitDryRun) {
      this.warn(
        'Read-only mode active (--read-only/--plan or BONSAI_READ_ONLY/BONSAI_PLAN_MODE): skipping filesystem writes.'
      );
    }
    return explicitDryRun || this.readOnly;
  }

  /**
   * Align the process exit code with the code reported in the JSON envelope. oclif's default
   * `catch` sets `process.exitCode = err.exitCode ?? 1`, but oclif `CLIError`s carry their code in
   * `err.oclif.exit` (never `err.exitCode`), so a usage error (`this.error(msg, { exit: 2 })`) would
   * exit the process with 1 under `--json` while `toErrorJson` correctly reports `exitCode: 2`. That
   * contradiction breaks the deterministic-exit-code contract agents rely on. Pre-seed the code from
   * the shared resolver so the framework's `??` keeps it, then defer to the default behavior.
   */
  public override async catch(
    err: Error & {
      oclif?: { exit?: number };
      exitCode?: number;
      code?: string;
      suggestions?: string[];
    }
  ) {
    // Parse failures throw before `this.parse()` sets `parsed`, which makes oclif emit a spurious
    // [UnparsedCommand] warning to stderr even under `--json`. CLIParseError subclasses carry `parse`.
    if (err && typeof err === 'object' && 'parse' in err) this.parsed = true;
    // Unwrap / fuzzy tips are no-ops when not applicable (including non-Error throws with no message).
    enrichParseError(err);
    enrichErrorForDisplay(err, { bin: this.config.bin, command: this.envelopeCommandId() });
    process.exitCode = process.exitCode ?? resolveExitCode(err);
    return super.catch(err);
  }

  /** Command id for the JSON envelope; falls back to the binary name when a command has no id. */
  protected envelopeCommandId(): string {
    return this.ctor.id ? toConfiguredId(this.ctor.id, this.config) : this.config.bin;
  }

  /**
   * Resolve a URL against the research cache, exiting on a normalization failure. A scheme-less but
   * domain-shaped input reports MISSING_URL_SCHEME — the same code the root `bonsai <url>` shorthand
   * uses — so an agent sees one stable code for "forgot https://" everywhere; truly unparseable input
   * stays INVALID_URL.
   */
  protected resolveResearchTargetOrFail(
    url: string,
    extra?: Pick<ResolveResearchTargetOptions, 'flagOverride' | 'lookup'>
  ): ResolvedResearchTarget {
    try {
      return resolveResearchTarget({
        configDir: this.config.configDir,
        cwd: process.cwd(),
        dataDir: this.config.dataDir,
        readOnly: this.readOnly,
        url,
        ...extra,
      });
    } catch (err) {
      this.failInvalidUrl(url, (err as Error).message);
    }
  }

  /** Exit for a URL that failed normalization; see {@link failInvalidUrl} for the code contract. */
  protected failInvalidUrl(url: string, message: string): never {
    failInvalidUrl((msg, opts) => this.error(msg, opts), url, message);
  }

  /** Command context handed to command services (fetch/import) so they stay oclif-free. */
  protected cliIo(): CliIo {
    return {
      bin: this.config.bin,
      configDir: this.config.configDir,
      dataDir: this.config.dataDir,
      cwd: process.cwd(),
      json: this.jsonEnabled(),
      warn: (msg) => void this.warn(msg),
      log: (msg) => this.log(msg),
      error: (msg, opts) => this.error(msg, opts),
    };
  }

  /** Single source of truth for the `--json` envelope shape, shared by success and error output. */
  private envelope(parts: {
    ok: boolean;
    exitCode: number;
    stderr: string;
    data: unknown;
  }): Record<string, unknown> {
    return buildEnvelope({
      command: this.envelopeCommandId(),
      ok: parts.ok,
      exitCode: parts.exitCode,
      stderr: parts.stderr,
      data: parts.data,
    });
  }

  /**
   * Base success envelope from `process.exitCode` (including exit 5 = served stale / ok).
   * Subclasses that overlay batch failures must call this — not `toSuccessJson` — to avoid
   * recursing through their own override.
   */
  protected baseSuccessJson(data: unknown): Record<string, unknown> {
    // ponytail: the stale-serve path signals EXIT_STALE_SERVED by setting process.exitCode inside
    // run() (e.g. fetch's handleStaleRevalidationResult); this reads it back to mark the envelope.
    // If that signalling moves off process.exitCode, update here too. Number() normalizes Node's
    // string codes.
    const exitCode = Number(process.exitCode ?? EXIT_OK);
    // EXIT_STALE_SERVED means "served stale" — a successful, usable result, so it reports ok.
    return this.envelope({
      ok: exitCode === EXIT_OK || exitCode === EXIT_STALE_SERVED,
      exitCode,
      stderr: '',
      data,
    });
  }

  /** Wrap a command's return value in the machine-readable envelope emitted under `--json`. */
  protected override toSuccessJson(data: unknown): Record<string, unknown> {
    return this.baseSuccessJson(data);
  }

  /**
   * Success overlay for multi-URL read commands (`status`, `inspect`). Apply CACHE_MISS first,
   * then row `.error` so validation failures win when both appear in one batch.
   */
  protected batchReadSuccessJson(data: unknown): Record<string, unknown> {
    return enrichRowErrorEnvelope(
      enrichCacheMissEnvelope(this.baseSuccessJson(data), data, this.config.bin),
      data
    );
  }

  /**
   * Map each URL through `fn`. In a multi-URL batch, per-URL CLIErrors become failure rows so
   * prior hits are kept — matching fetch's INVALID_URL / MISSING_URL_SCHEME batch contract.
   */
  protected mapUrlsAllowingBatchErrors<T, F>(
    urls: string[],
    fn: (url: string) => T,
    failureRow: (url: string, err: InstanceType<typeof Errors.CLIError>) => F
  ): Array<T | F> {
    const batch = urls.length > 1;
    const results: Array<T | F> = [];
    for (const url of urls) {
      try {
        results.push(fn(url));
      } catch (err) {
        if (!batch || !(err instanceof Errors.CLIError)) throw err;
        // Mirror the single-URL error format (message + Code: + Try this:) rather than a bare
        // message, so a row failure in a batch is exactly as actionable as it is standalone.
        if (!this.jsonEnabled()) this.warn(formatErrorForJson(err));
        results.push(failureRow(url, err));
      }
    }
    return results;
  }

  /** Mirror the success envelope for failures so JSON consumers get one consistent shape. */
  protected override toErrorJson(err: unknown): Record<string, unknown> {
    const prepared = prepareCliError(err, {
      bin: this.config.bin,
      command: this.envelopeCommandId(),
    });
    // oclif prints the returned object to stdout; error text lives in envelope.stderr only
    // so process stderr stays clean under `--json` (CACHE_MISS / batch overlays + oclif JSON log suppression).
    return buildEnvelope({
      command: this.envelopeCommandId(),
      ok: false,
      exitCode: prepared.exitCode,
      stderr: prepared.stderr,
      data: null,
      code: prepared.code,
      suggestions: prepared.suggestions,
      ref: prepared.ref,
    });
  }
}
