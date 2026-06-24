import { Args, Flags } from '@oclif/core';
import { ConfigCommand, configScopeFlags } from './base.js';
import { writeUserConfig, writeProjectConfig } from '../../lib/config/index.js';
import type { ConfigValues } from '../../lib/config/index.js';

export default class ConfigUnset extends ConfigCommand<typeof ConfigUnset> {
  static id = 'config unset';
  static summary = 'Remove a research configuration key.';
  static description =
    'Delete a key from user-level config (default) or project-level config (--local), restoring the built-in default.\n\nValid keys: storage.';

  static examples = [
    {
      description: 'Remove the user-level storage setting',
      command: '<%= config.bin %> config unset storage',
    },
    {
      description: 'Remove the project-level storage setting',
      command: '<%= config.bin %> config unset storage --local',
    },
  ];

  static args = {
    key: Args.string({ required: true, description: 'The configuration key to remove.' }),
  };

  static flags = {
    ...configScopeFlags({
      global: 'Remove from user-level config (default).',
      local: 'Remove from project-level config (.bonsai.json in cwd).',
    }),
    'dry-run': Flags.boolean({
      description: 'Show what would be removed without saving.',
      default: false,
    }),
  };

  static stdoutIsPrimaryData = true;

  async init(): Promise<void> {
    await super.init();
    const { args, flags } = await this.parse(ConfigUnset);
    this.args = args;
    this.flags = flags;
  }

  async execute(): Promise<unknown> {
    const key = this.args.key;
    this.assertKnownKey(key);
    this.assertScopeFlagsExclusive(this.flags.global, this.flags.local);

    const scope = this.writeScope(this.flags.local);

    if (this.flags['dry-run']) {
      if (!this.requestedJson()) this.log(`[dry-run] Would unset ${key} (${scope})`);
      return { key, scope, dryRun: true };
    }

    const patch = { [key]: undefined } as Partial<ConfigValues>;
    if (scope === 'project') {
      writeProjectConfig(process.cwd(), patch);
    } else {
      const configDir = this.config.configDir;
      if (!configDir) {
        this.error(
          'Could not determine user config directory. Use --local to remove project config.',
          {
            exit: 1,
          }
        );
      }
      writeUserConfig(configDir, patch);
    }

    if (!this.requestedJson()) this.log(`Unset ${key} (${scope})`);
    return { key, scope, dryRun: false };
  }
}
