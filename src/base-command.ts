import { Command, Errors, Interfaces } from '@oclif/core';

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

  /** Command id for the JSON envelope; falls back to the binary name when a command has no id. */
  protected envelopeCommandId(): string {
    return this.ctor.id || this.config.bin;
  }

  /** Single source of truth for the `--json` envelope shape, shared by success and error output. */
  private envelope(parts: {
    ok: boolean;
    exitCode: number;
    stderr: string;
    data: unknown;
  }): Record<string, unknown> {
    return {
      schemaVersion: 1,
      command: this.envelopeCommandId(),
      ok: parts.ok,
      exitCode: parts.exitCode,
      stdout: '',
      stderr: parts.stderr,
      data: parts.data,
    };
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
    const e = err as { oclif?: { exit?: number }; exitCode?: number; message?: string };
    const exitCode = e?.oclif?.exit ?? e?.exitCode ?? 1;
    return this.envelope({ ok: false, exitCode, stderr: e?.message ?? String(err), data: null });
  }
}
