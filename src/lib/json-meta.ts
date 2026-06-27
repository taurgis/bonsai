import { Config, Help, toConfiguredId } from '@oclif/core';
import { buildEnvelope } from './envelope.js';

/** Strip ANSI color codes so JSON help text stays machine-stable. */
function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

/** True when argv asks for help or version together with --json. */
export function isJsonMetaRequest(argv: readonly string[]): boolean {
  if (!argv.includes('--json')) return false;
  return argv.includes('--help') || argv.includes('--version');
}

class CaptureHelp extends Help {
  readonly lines: string[] = [];

  protected override log(...args: string[]): void {
    for (const line of args) {
      // oclif emits section separators as log(''); drop empties so data.help stays compact.
      if (line) this.lines.push(line);
    }
  }
}

function helpSubject(argv: readonly string[]): string | undefined {
  for (const arg of argv) {
    if (arg === '--' || arg === '--help' || arg === 'help') continue;
    if (arg.startsWith('-')) return;
    return arg;
  }
  return undefined;
}

function envelopeCommandId(config: Config, argv: readonly string[]): string {
  const subject = helpSubject(argv);
  if (!subject) return config.bin;
  const command = config.findCommand(subject);
  if (command?.id) return toConfiguredId(command.id, config);
  const topic = config.findTopic(subject);
  if (topic) return topic.name;
  return subject;
}

/**
 * When `--json` is combined with `--help` or `--version`, oclif would print human text to stdout.
 * Render the same content inside the standard Bonsai JSON envelope instead.
 */
export async function tryJsonMetaOutput(
  argv: readonly string[],
  root: string
): Promise<{ exitCode: number; envelope: Record<string, unknown> } | null> {
  if (!isJsonMetaRequest(argv)) return null;

  try {
    const config = await Config.load({ root });

    if (argv.includes('--version')) {
      return {
        exitCode: 0,
        envelope: buildEnvelope({
          command: config.bin,
          ok: true,
          exitCode: 0,
          stderr: '',
          data: {
            version: config.version,
            userAgent: config.userAgent,
          },
        }),
      };
    }

    const help = new CaptureHelp(config, config.pjson.oclif?.helpOptions ?? {});
    await help.showHelp([...argv]);

    const helpText = stripAnsi(help.lines.join('\n').trimEnd());

    return {
      exitCode: 0,
      envelope: buildEnvelope({
        command: envelopeCommandId(config, argv),
        ok: true,
        exitCode: 0,
        stderr: '',
        data: { help: helpText },
      }),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      exitCode: 1,
      envelope: buildEnvelope({
        command: 'bonsai',
        ok: false,
        exitCode: 1,
        stderr: message,
        data: null,
        code: 'META_RENDER_FAILED',
      }),
    };
  }
}
