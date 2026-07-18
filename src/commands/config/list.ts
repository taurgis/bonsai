import { ConfigCommand, configScopeFlags } from './base.js';
import {
  ALL_KEYS,
  formatConfigEntry,
  readScopedConfig,
  resolveConfigEntry,
  validKeysHint,
} from '../../lib/config/index.js';

export default class ConfigList extends ConfigCommand<typeof ConfigList> {
  static id = 'config list';
  static summary = 'List all research configuration keys and their effective values.';
  static description = `Show every configuration key with its current value. Use --global/--local to show a single scope.\n\nValid keys: ${validKeysHint()}.`;

  static examples = [
    {
      description: 'show all effective config values',
      command: '<%= config.bin %> config list',
    },
    {
      description: 'show only project-level config',
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
    const entries = ALL_KEYS.map((key) => resolveConfigEntry(key, scoped));

    if (!this.jsonEnabled()) {
      const width = Math.max(...ALL_KEYS.map((k) => k.length)) + 2;
      for (const entry of entries) {
        this.log(`${entry.key.padEnd(width)}${formatConfigEntry(entry)}`);
      }
    }

    // Bare array — same shape as `list`'s data payload; no `{ entries }` wrapper.
    return entries;
  }
}
