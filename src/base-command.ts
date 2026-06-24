import { Command, Flags, Interfaces } from '@oclif/core';

export abstract class BaseCommand<T extends typeof Command> extends Command {
  static jsonEnvelope = false;

  static baseFlags = {
    json: Flags.boolean({
      description: 'Return the output as a machine-readable JSON object.',
    }),
  };

  flags!: Interfaces.InferredFlags<T['flags'] & typeof BaseCommand.baseFlags>;
  args!: Interfaces.InferredArgs<T['args']>;

  protected requestedJson(): boolean {
    return Boolean(this.flags?.json);
  }

  protected override async _run<R>(): Promise<R> {
    // Check argv directly for --json because if parsing fails in init(),
    // we still want to output the failure in the JSON envelope format.
    const isJson = this.argv.includes('--json');
    if (isJson) {
      try {
        await this.init();
        const result = await this.run();
        const exitCode = process.exitCode || 0;
        console.log(
          JSON.stringify(
            {
              schemaVersion: 1,
              command: this.ctor.id ?? 'research',
              ok: exitCode === 0 || exitCode === 5,
              exitCode,
              stdout: '',
              stderr: '',
              data: result,
            },
            null,
            2
          )
        );
      } catch (error: any) {
        const exitCode = error.oclif?.exit ?? 1;
        console.log(
          JSON.stringify(
            {
              schemaVersion: 1,
              command: this.ctor.id ?? 'research',
              ok: false,
              exitCode,
              stdout: '',
              stderr: error.message || String(error),
              data: null,
            },
            null,
            2
          )
        );
        process.exitCode = exitCode;
      }
      return undefined as R;
    }

    return super._run<R>();
  }

  abstract execute(): Promise<unknown>;

  async run(): Promise<unknown> {
    return this.execute();
  }
}
