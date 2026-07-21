import { BaseCommand } from '../base-command.js';
import { commands } from '../commands.js';
import { valueTakingFlagTokensFromCommands } from './value-flags.js';

/**
 * Composition-root flag manifest: every CLI token that consumes a following argv value.
 * Built from command class metadata so argv normalization stays free of command imports.
 */
export const VALUE_TAKING_FLAG_TOKENS: ReadonlySet<string> = valueTakingFlagTokensFromCommands(
  commands,
  BaseCommand.baseFlags
);

/**
 * Root segment of every registered command id (`config:get` → `config`). oclif joins namespaced
 * command ids with `:` regardless of the display-only `topicSeparator` setting, so a token like
 * `config:get` is a real command, not a URL — argv normalization checks this set before assuming
 * `word:` is a URL scheme.
 */
export const KNOWN_COMMAND_ROOT_TOKENS: ReadonlySet<string> = new Set(
  Object.keys(commands).map((id) => id.split(':')[0]!)
);
