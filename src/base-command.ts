import { Command, Errors, Interfaces, toConfiguredId } from '@oclif/core';
import { invalidEnvOverrideWarnings } from './lib/config/index.js';
import {
  buildEnvelope,
  formatErrorForJson,
  normalizeCliErrorMessage,
  stableErrorCodeFrom,
} from './lib/envelope.js';
import {
  resolveResearchTarget,
  type ResolveResearchTargetOptions,
  type ResolvedResearchTarget,
} from './lib/research/resolve-target.js';

/**
 * Shared base for every Bonsai command. Enables oclif's native `--json` flag,
 * parses args/flags once in `init()` so commands read `this.args`/`this.flags`
 * directly in `run()`, and wraps `--json` output in the Bonsai envelope via the
 * framework's `toSuccessJson`/`toErrorJson` hooks.
 */
export abstract class BaseCommand<T extends typeof Command> extends Command {
  static enableJsonFlag = true;

  flags!: Interfaces.InferredFlags<T['flags']>;
  args!: Interfaces.InferredArgs<T['args']>;

  public override async init(): Promise<void> {
    await super.init();
    const { args, flags } = await this.parse({
      flags: this.ctor.flags,
      enableJsonFlag: this.ctor.enableJsonFlag,
      args: this.ctor.args,
      strict: this.ctor.strict,
    });
    this.flags = flags as Interfaces.InferredFlags<T['flags']>;
    this.args = args as Interfaces.InferredArgs<T['args']>;

    // Surface a set-but-invalid BONSAI_* override once per run. Resolution silently drops such a
    // value, so without this a typo'd env var would take no effect with no signal. Warnings go to
    // stderr (even under --json), so machine output stays clean.
    for (const warning of invalidEnvOverrideWarnings(process.env)) this.warn(warning);
  }

  /**
   * Always surface warnings on stderr, even under `--json`. oclif silences `warn()` in JSON mode,
   * but our warnings (secret-redirect, stale-serve, remote-search fallback, prune failures) are
   * security- and freshness-relevant side effects users must see. stderr never pollutes the stdout
   * JSON envelope, so machine output stays clean.
   */
  public override warn(input: string | Error): string | Error {
    Errors.warn(input);
    return input;
  }

  /**
   * The exit code an error maps to. oclif `CLIError`s carry it in `err.oclif.exit`; other errors may
   * expose `err.exitCode`. Defined once so the process exit code (`catch`) and the JSON envelope
   * (`toErrorJson`) can never disagree — a mismatch between these two was itself the bug this fixes.
   */
  private static exitCodeOf(err: { oclif?: { exit?: number }; exitCode?: number }): number {
    return err?.oclif?.exit ?? err?.exitCode ?? 1;
  }

  /**
   * Align the process exit code with the code reported in the JSON envelope. oclif's default
   * `catch` sets `process.exitCode = err.exitCode ?? 1`, but oclif `CLIError`s carry their code in
   * `err.oclif.exit` (never `err.exitCode`), so a usage error (`this.error(msg, { exit: 2 })`) would
   * exit the process with 1 under `--json` while `toErrorJson` correctly reports `exitCode: 2`. That
   * contradiction breaks the deterministic-exit-code contract agents rely on. Pre-seed the code from
   * the shared resolver so the framework's `??` keeps it, then defer to the default behavior.
   */
  public override async catch(err: Error & { oclif?: { exit?: number }; exitCode?: number }) {
    // Parse failures throw before `this.parse()` sets `parsed`, which makes oclif emit a spurious
    // [UnparsedCommand] warning to stderr even under `--json`. CLIParseError subclasses carry `parse`.
    if (err && typeof err === 'object' && 'parse' in err) this.parsed = true;
    process.exitCode = process.exitCode ?? BaseCommand.exitCodeOf(err);
    return super.catch(err);
  }

  /** Command id for the JSON envelope; falls back to the binary name when a command has no id. */
  protected envelopeCommandId(): string {
    return this.ctor.id ? toConfiguredId(this.ctor.id, this.config) : this.config.bin;
  }

  /** Resolve a URL against the research cache, exiting with INVALID_URL on normalization failure. */
  protected resolveResearchTargetOrFail(
    url: string,
    extra?: Pick<ResolveResearchTargetOptions, 'flagOverride' | 'lookup'>
  ): ResolvedResearchTarget {
    try {
      return resolveResearchTarget({
        configDir: this.config.configDir,
        cwd: process.cwd(),
        dataDir: this.config.dataDir,
        url,
        ...extra,
      });
    } catch (err) {
      this.error(`Invalid URL: ${(err as Error).message}`, { exit: 2, code: 'INVALID_URL' });
    }
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

  /** Wrap a command's return value in the machine-readable envelope emitted under `--json`. */
  protected override toSuccessJson(data: unknown): Record<string, unknown> {
    // ponytail: the stale-serve path signals "exit 5" by setting process.exitCode inside run()
    // (e.g. fetch's handleStaleRevalidationResult); this reads it back to mark the envelope. If that
    // signalling moves off process.exitCode, update here too. Number() normalizes Node's string codes.
    const exitCode = Number(process.exitCode ?? 0);
    // Exit 5 means "served stale" — a successful, usable result, so it reports ok.
    return this.envelope({ ok: exitCode === 0 || exitCode === 5, exitCode, stderr: '', data });
  }

  /** Mirror the success envelope for failures so JSON consumers get one consistent shape. */
  protected override toErrorJson(err: unknown): Record<string, unknown> {
    const e = err as {
      oclif?: { exit?: number };
      exitCode?: number;
      message?: string;
      code?: string;
      suggestions?: string[];
      ref?: string;
    };
    const exitCode = BaseCommand.exitCodeOf(e);
    const code = stableErrorCodeFrom(e);
    const message =
      typeof e?.message === 'string' ? normalizeCliErrorMessage(e.message) : undefined;
    const stderr =
      message || code || e?.suggestions?.length || e?.ref
        ? formatErrorForJson({ ...e, message, code })
        : String(err);
    return buildEnvelope({
      command: this.envelopeCommandId(),
      ok: false,
      exitCode,
      stderr,
      data: null,
      code,
      suggestions: e.suggestions?.length ? e.suggestions : undefined,
      ref: e.ref,
    });
  }
}
