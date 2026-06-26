import { ConfigCommand, configScopeFlags } from './base.js';
import {
  ALL_KEYS,
  KEY_META,
  BUILT_IN_DEFAULTS,
  readScopedConfig,
  validKeysHint,
} from '../../lib/config/index.js';

export default class ConfigList extends ConfigCommand<typeof ConfigList> {
  static id = 'config list';
  static summary = 'List all research configuration keys and their effective values.';
  static description = `Show every configuration key with its current value. Use --global/--local to show a single scope.\n\nValid keys: ${validKeysHint()}.`;

  static examples = [
    {
      description: 'Show all effective config values',
      command: '<%= config.bin %> config list',
    },
    {
      description: 'Show only project-level config',
      command: '<%= config.bin %> config list --local',
    },
  ];

  static flags = {
    ...configScopeFlags({
      global: 'Show user-level config only.',
      local: 'Show project-level config only.',
    }),
  };

  static stdoutIsPrimaryData = true;

  async run(): Promise<unknown> {
    this.assertScopeFlagsExclusive(this.flags.global, this.flags.local);

    const scope = this.readScope(this.flags.global, this.flags.local);
    const scoped = readScopedConfig(scope, this.config.configDir, process.cwd());

    if (!this.jsonEnabled()) {
      const width = Math.max(...ALL_KEYS.map((k) => k.length)) + 2;
      for (const key of ALL_KEYS) {
        const raw = scoped[key];
        const formatted = raw !== undefined ? KEY_META[key].format(raw) : '(not configured)';
        this.log(`${key.padEnd(width)}${formatted}`);
      }
    }

    const values: Record<string, unknown> = {};
    for (const key of ALL_KEYS) {
      const raw = scoped[key];
      values[key] = raw !== undefined ? raw : BUILT_IN_DEFAULTS[key];
    }
    return values;
  }
}
