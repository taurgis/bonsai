import { ConfigCommand, configScopeFlags } from './base.js';
import { formatConfigEntry, resolveConfigEntries, validKeysHint } from '../../lib/config/index.js';

export default class ConfigList extends ConfigCommand<typeof ConfigList> {
  static id = 'config list';
  static summary = 'List research configuration values';
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
      global: 'show user-level config only',
      local: 'show project-level config only',
    }),
  };

  static stdoutIsPrimaryData = true;

  async run(): Promise<unknown> {
    this.assertScopeFlagsExclusive(this.flags.global, this.flags.local);

    const scope = this.readScope(this.flags.global, this.flags.local);
    const entries = resolveConfigEntries(scope, this.config.configDir, process.cwd());

    if (!this.jsonEnabled()) {
      const width = Math.max(...entries.map((e) => e.key.length)) + 2;
      for (const entry of entries) {
        this.log(`${entry.key.padEnd(width)}${formatConfigEntry(entry, scope)}`);
      }
    }

    // Bare array — same shape as `list`'s data payload; no `{ entries }` wrapper.
    return entries;
  }
}
