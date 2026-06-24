import { Args, Flags } from '@oclif/core';
import { ConfigCommand, configScopeFlags } from './base.js';
import { KEY_META, writeUserConfig, writeProjectConfig } from '../../lib/config/index.js';
import type { ConfigValues } from '../../lib/config/index.js';

export default class ConfigSet extends ConfigCommand<typeof ConfigSet> {
  static id = 'config set';
  static summary = 'Set a research configuration key.';
  static description =
    'Persist a configuration value. Writes user-level config by default; pass --local to write the project-level config (.bonsai.json in cwd).\n\n' +
    'Valid keys: storage. The inline form `<key>=<value>` is also accepted.';

  static examples = [
    {
      description: 'Store research cache inside the current project',
      command: '<%= config.bin %> config set storage project --local',
    },
    {
      description: 'Set the user-level default using the inline key=value form',
      command: '<%= config.bin %> config set storage=global',
    },
  ];

  static args = {
    key: Args.string({ required: false, description: 'The configuration key to set.' }),
    value: Args.string({ required: false, description: 'The value to assign.' }),
  };

  static flags = {
    ...configScopeFlags({
      global: 'Write to user-level config (default).',
      local: 'Write to project-level config (.bonsai.json in cwd).',
    }),
    'dry-run': Flags.boolean({
      description: 'Show what would be written without saving.',
      default: false,
    }),
  };

  static stdoutIsPrimaryData = true;

  async init(): Promise<void> {
    await super.init();
    const { args, flags } = await this.parse(ConfigSet);
    this.args = args;
    this.flags = flags;
  }

  async execute(): Promise<unknown> {
    const { keyArg, valueArg } = splitInlineKeyValue(this.args.key, this.args.value);

    if (!keyArg) {
      this.error('Missing required argument: key', { exit: 2 });
    }
    this.assertKnownKey(keyArg);
    this.assertScopeFlagsExclusive(this.flags.global, this.flags.local);

    const meta = KEY_META[keyArg];
    if (valueArg === undefined) {
      this.error(`Missing required argument: value for key "${keyArg}"`, { exit: 2 });
    }
    const parsed = meta.parseValue(valueArg);
    if (!meta.isValid(parsed)) {
      const guidance = meta.values ? `Valid values: ${meta.values.join(', ')}.` : meta.description;
      this.error(`Invalid value "${valueArg}" for "${keyArg}". ${guidance}`, { exit: 2 });
    }

    const scope = this.writeScope(this.flags.local);
    const formatted = meta.format(parsed);

    if (this.flags['dry-run']) {
      if (!this.requestedJson())
        this.log(`[dry-run] Would set ${keyArg} = ${formatted} (${scope})`);
      return { key: keyArg, value: parsed, scope, dryRun: true };
    }

    const patch = { [keyArg]: parsed } as Partial<ConfigValues>;
    if (scope === 'project') {
      writeProjectConfig(process.cwd(), patch);
    } else {
      const configDir = this.config.configDir;
      if (!configDir) {
        this.error(
          'Could not determine user config directory. Use --local to write project config.',
          {
            exit: 1,
          }
        );
      }
      writeUserConfig(configDir, patch);
    }

    if (!this.requestedJson()) this.log(`Set ${keyArg} = ${formatted} (${scope})`);
    return { key: keyArg, value: parsed, scope, dryRun: false };
  }
}

/**
 * Accept the `key=value` convenience form alongside the canonical `key value`.
 * Splits only when no separate value positional was supplied, and on the FIRST `=`
 * so a value may itself contain `=`.
 */
export function splitInlineKeyValue(
  rawKey: string | undefined,
  rawValue: string | undefined
): { keyArg: string | undefined; valueArg: string | undefined } {
  if (rawValue === undefined && rawKey !== undefined) {
    const eq = rawKey.indexOf('=');
    if (eq !== -1) {
      return { keyArg: rawKey.slice(0, eq), valueArg: rawKey.slice(eq + 1) };
    }
  }
  return { keyArg: rawKey, valueArg: rawValue };
}
