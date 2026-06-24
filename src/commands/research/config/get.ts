import { Args } from '@oclif/core';
import { ConfigCommand, configScopeFlags } from './base.js';
import { KEY_META, BUILT_IN_DEFAULTS, readScopedConfig } from '../../../lib/config/index.js';

export default class ResearchConfigGet extends ConfigCommand<typeof ResearchConfigGet> {
  static id = 'research config get';
  static summary = 'Get the effective value of a research configuration key.';
  static description =
    'Print a config value. Without --global/--local, shows the merged effective value (flag > env > project > user > default).\n\nValid keys: storage.';

  static examples = [
    {
      description: 'Get the effective storage mode',
      command: '<%= config.bin %> research config get storage',
    },
    {
      description: 'Read only the project-level value',
      command: '<%= config.bin %> research config get storage --local',
    },
  ];

  static args = {
    key: Args.string({ required: true, description: 'The configuration key to read.' }),
  };

  static flags = {
    ...configScopeFlags({
      global: 'Read from user-level config only.',
      local: 'Read from project-level config only.',
    }),
  };

  static stdoutIsPrimaryData = true;

  async init(): Promise<void> {
    await super.init();
    const { args, flags } = await this.parse(ResearchConfigGet);
    this.args = args;
    this.flags = flags;
  }

  async execute(): Promise<unknown> {
    const key = this.args.key;
    this.assertKnownKey(key);
    this.assertScopeFlagsExclusive(this.flags.global, this.flags.local);

    const scope = this.readScope(this.flags.global, this.flags.local);
    const value = readScopedConfig(scope, this.config.configDir, process.cwd())[key];

    const meta = KEY_META[key];
    const displayValue = value !== undefined ? value : BUILT_IN_DEFAULTS[key];
    const formatted = meta.format(displayValue);
    const suffix = value === undefined ? ' (not configured)' : '';
    if (!this.requestedJson()) this.log(formatted + suffix);

    return { key, value: displayValue };
  }
}
