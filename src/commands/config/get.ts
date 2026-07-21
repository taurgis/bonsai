import { Args } from '@oclif/core';
import { ConfigCommand, configScopeFlags } from './base.js';
import { formatConfigEntry, resolveConfigEntry, keyValuesHint } from '../../lib/config/index.js';

export default class ConfigGet extends ConfigCommand<typeof ConfigGet> {
  static id = 'config get';
  static summary = 'Get a research configuration value';
  static description = `Print a config value. Without --global/--local, shows the merged effective value, in precedence order: a per-command override flag (e.g. \`fetch --storage\`) > env var > project file > user file > built-in default.\n\nValid keys: ${keyValuesHint()}.`;

  static examples = [
    {
      description: 'get the effective storage mode',
      command: '<%= config.bin %> config get storage',
    },
    {
      description: 'read only the project-level value',
      command: '<%= config.bin %> config get storage --local',
    },
  ];

  static args = {
    key: Args.string({ required: false, description: 'the configuration key to read' }),
  };

  static flags = {
    ...configScopeFlags({
      global: 'read user-level config only',
      local: 'read project-level config only',
    }),
  };

  static stdoutIsPrimaryData = true;

  async run(): Promise<unknown> {
    const key = this.args.key;
    this.validateConfigKeyAndScope(key, this.flags.global, this.flags.local);

    const scope = this.readScope(this.flags.global, this.flags.local);
    const entry = resolveConfigEntry(key, scope, this.config.configDir, process.cwd());

    if (!this.jsonEnabled()) this.log(formatConfigEntry(entry, scope));
    return entry;
  }
}
