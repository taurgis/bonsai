import { Args, Flags } from '@oclif/core';
import { ConfigCommand, configScopeFlags } from './base.js';
import { keyValuesHint } from '../../lib/config/index.js';
import type { ConfigValues } from '../../lib/config/index.js';
import { persistConfigPatch } from '../../lib/config-persist.js';
import type { ConfigWriteResult } from '../../lib/cli-result-types.js';

export default class ConfigUnset extends ConfigCommand<typeof ConfigUnset> {
  static id = 'config unset';
  static summary = 'Remove a research configuration key';
  static description = `Delete a key from user-level config (default) or project-level config (--local), restoring the built-in default.\n\nValid keys: ${keyValuesHint()}.`;

  static examples = [
    {
      description: 'remove the user-level storage setting',
      command: '<%= config.bin %> config unset storage',
    },
    {
      description: 'remove the project-level storage setting',
      command: '<%= config.bin %> config unset storage --local',
    },
  ];

  static args = {
    key: Args.string({ required: false, description: 'the configuration key to remove' }),
  };

  static flags = {
    ...configScopeFlags({
      global: 'remove from user-level config (default)',
      local: 'remove from project-level config (.bonsai.json in cwd)',
    }),
    'dry-run': Flags.boolean({
      description: 'preview removal without saving',
      default: false,
    }),
  };

  static stdoutIsPrimaryData = true;

  async run(): Promise<ConfigWriteResult> {
    const key = this.args.key;
    this.validateConfigKeyAndScope(key, this.flags.global, this.flags.local);

    const scope = this.writeScope(this.flags.local);
    const dryRun = this.effectiveDryRun(this.flags['dry-run']);
    if (dryRun) {
      if (!this.jsonEnabled()) this.log(`[dry-run] Would unset ${key} (${scope})`);
      return { key, scope, dryRun: true, status: 'would_unset' };
    }

    const persisted = persistConfigPatch({
      scope,
      cwd: process.cwd(),
      configDir: this.config.configDir,
      patch: { [key]: undefined } as Partial<ConfigValues>,
      action: 'unset',
      bin: this.config.bin,
      key,
    });
    if (!persisted.ok) {
      this.error(persisted.message, {
        exit: 1,
        code: persisted.code,
        suggestions: persisted.suggestions,
      });
    }

    if (!this.jsonEnabled()) this.log(`Unset ${key} (${scope})`);
    return { key, scope, dryRun: false, status: 'unset' };
  }
}
