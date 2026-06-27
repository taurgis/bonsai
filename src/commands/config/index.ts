import { Help, toConfiguredId } from '@oclif/core';
import { BaseCommand } from '../../base-command.js';

export default class ConfigIndex extends BaseCommand<typeof ConfigIndex> {
  static id = 'config';
  static summary = 'Manage research cache storage configuration (global vs project).';
  static description =
    'Show config subcommands for reading and writing Bonsai research cache configuration.';

  static examples = [
    {
      description: 'get a configuration value',
      command: '<%= config.bin %> <%= command.id %> get storage',
    },
    {
      description: 'set a configuration value for the current project',
      command: '<%= config.bin %> <%= command.id %> set storage project --local',
    },
  ];

  static stdoutIsPrimaryData = true;

  async run(): Promise<unknown> {
    if (!this.jsonEnabled()) {
      await new Help(this.config, this.config.pjson.oclif.helpOptions ?? {}).showHelp(['config']);
    }

    const commands = this.config.commands
      .filter((c) => c.id.startsWith('config:') && !c.hidden)
      .map((c) => ({
        id: toConfiguredId(c.id, this.config),
        summary: c.summary || c.description || '',
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    return {
      topic: 'config',
      commands,
    };
  }
}
