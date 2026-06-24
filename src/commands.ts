import Bonsai from './commands/index.js';
import ConfigGet from './commands/config/get.js';
import ConfigList from './commands/config/list.js';
import ConfigSet from './commands/config/set.js';
import ConfigUnset from './commands/config/unset.js';
import ImportCommand from './commands/import.js';
import InspectCommand from './commands/inspect.js';
import ListCommand from './commands/list.js';
import PruneCommand from './commands/prune.js';
import SearchCommand from './commands/search.js';
import StatusCommand from './commands/status.js';

export const commands = {
  'Symbol(SINGLE_COMMAND_CLI)': Bonsai,
  import: ImportCommand,
  inspect: InspectCommand,
  list: ListCommand,
  prune: PruneCommand,
  search: SearchCommand,
  status: StatusCommand,
  'config:get': ConfigGet,
  'config:list': ConfigList,
  'config:set': ConfigSet,
  'config:unset': ConfigUnset,
};
