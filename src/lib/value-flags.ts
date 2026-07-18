import type { Command } from '@oclif/core';

type FlagDef = {
  type?: string;
  char?: string;
  aliases?: string[] | string;
  charAliases?: string[];
};

type CommandClass = {
  flags?: Record<string, FlagDef>;
  baseFlags?: Record<string, FlagDef>;
};

/**
 * Derive every CLI token that consumes a following argv value from command class metadata
 * (long names, short chars, aliases). Used by argv normalization so FLAGS_WITH_VALUES cannot
 * drift from the real command surface.
 */
export function valueTakingFlagTokens(
  commandClasses: Iterable<CommandClass>,
  extraBaseFlags: Record<string, FlagDef> = {}
): Set<string> {
  const tokens = new Set<string>();
  for (const command of commandClasses) {
    const flags = { ...extraBaseFlags, ...command.baseFlags, ...command.flags };
    for (const [name, flag] of Object.entries(flags)) {
      if (!flag || flag.type === 'boolean') continue;
      tokens.add(`--${name}`);
      if (flag.char) tokens.add(`-${flag.char}`);
      const aliases = flag.aliases;
      if (typeof aliases === 'string') tokens.add(`--${aliases}`);
      else for (const alias of aliases ?? []) tokens.add(`--${alias}`);
      for (const charAlias of flag.charAliases ?? []) tokens.add(`-${charAlias}`);
    }
  }
  return tokens;
}

/** Narrow helper for oclif Command constructors. */
export function valueTakingFlagTokensFromCommands(
  commands: Record<string, typeof Command>,
  extraBaseFlags: Record<string, FlagDef> = {}
): Set<string> {
  return valueTakingFlagTokens(Object.values(commands) as CommandClass[], extraBaseFlags);
}
