import { Args } from '@oclif/core';
import { ConfigCommand, configScopeFlags } from './base.js';
import {
  KEY_META,
  BUILT_IN_DEFAULTS,
  readScopedConfig,
  validKeysHint,
} from '../../lib/config/index.js';

export default class ConfigGet extends ConfigCommand<typeof ConfigGet> {
  static id = 'config get';
  static summary = 'Get the effective value of a research configuration key.';
  static description = `Print a config value. Without --global/--local, shows the merged effective value (flag > env > project > user > default).\n\nValid keys: ${validKeysHint()}.`;

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
      global: 'Read from user-level config only.',
      local: 'Read from project-level config only.',
    }),
  };

  static stdoutIsPrimaryData = true;

  async run(): Promise<unknown> {
    const key = this.args.key;
    this.validateConfigKeyAndScope(key, this.flags.global, this.flags.local);

    const scope = this.readScope(this.flags.global, this.flags.local);
    const value = readScopedConfig(scope, this.config.configDir, process.cwd())[key];

    const meta = KEY_META[key];
    const displayValue = value !== undefined ? value : BUILT_IN_DEFAULTS[key];
    const formatted = meta.format(displayValue);
    const suffix = value === undefined ? ' (not configured)' : '';
    if (!this.jsonEnabled()) this.log(formatted + suffix);

    return { key, value: displayValue };
  }
}
