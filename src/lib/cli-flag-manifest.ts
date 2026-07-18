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
