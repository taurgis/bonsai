import { describe, it, expect } from 'vitest';
import { commands } from './commands.js';
import FetchCommand from './commands/fetch.js';
import ImportCommand from './commands/import.js';
import InspectCommand from './commands/inspect.js';
import ListCommand from './commands/list.js';
import PruneCommand from './commands/prune.js';
import StatusCommand from './commands/status.js';
import ConfigGet from './commands/config/get.js';
import ConfigIndex from './commands/config/index.js';
import ConfigList from './commands/config/list.js';
import ConfigSet from './commands/config/set.js';
import ConfigUnset from './commands/config/unset.js';

describe('command registry', () => {
  it('maps every expected key to its command class', () => {
    expect(commands).toEqual({
      fetch: FetchCommand,
      import: ImportCommand,
      inspect: InspectCommand,
      list: ListCommand,
      prune: PruneCommand,
      status: StatusCommand,
      config: ConfigIndex,
      'config:get': ConfigGet,
      'config:list': ConfigList,
      'config:set': ConfigSet,
      'config:unset': ConfigUnset,
    });
  });

  it('exposes exactly the expected command keys', () => {
    expect(Object.keys(commands).sort()).toEqual(
      [
        'config:get',
        'config',
        'config:list',
        'config:set',
        'config:unset',
        'fetch',
        'import',
        'inspect',
        'list',
        'prune',
        'status',
      ].sort()
    );
  });
});
