import { Config, Help, toConfiguredId } from '@oclif/core';
import { positionalArgvTokens } from './argv.js';
import { buildEnvelope } from './envelope.js';

/** Strip ANSI color codes so JSON help text stays machine-stable. */
function stripAnsi(text: string): string {
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

function envelopeCommandId(config: Config, argv: readonly string[]): string {
  const tokens = positionalArgvTokens(argv);
  if (tokens.length === 0) return config.bin;

  // Longest matching command id wins (`config:get` over topic `config`).
  for (let n = tokens.length; n >= 1; n--) {
    const id = tokens.slice(0, n).join(':');
    const command = config.findCommand(id);
    if (command?.id) return toConfiguredId(command.id, config);
  }

  const topic = config.findTopic(tokens[0]!);
  if (topic) return topic.name;
  return tokens[0]!;
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
