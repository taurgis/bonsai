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

/** Every argv token that selects this flag: long name, short char, and all aliases. */
function flagTokens(name: string, flag: FlagDef): string[] {
  const tokens = [`--${name}`];
  if (flag.char) tokens.push(`-${flag.char}`);
  const aliases = typeof flag.aliases === 'string' ? [flag.aliases] : (flag.aliases ?? []);
  tokens.push(...aliases.map((alias) => `--${alias}`));
  tokens.push(...(flag.charAliases ?? []).map((charAlias) => `-${charAlias}`));
  return tokens;
}

/**
 * Derive every CLI token that consumes a following argv value from command class metadata
 * (long names, short chars, aliases). Used by argv normalization so VALUE_TAKING_FLAG_TOKENS
 * cannot drift from the real command surface.
 */
export function valueTakingFlagTokensFromCommands(
  commands: Record<string, typeof Command>,
  extraBaseFlags: Record<string, FlagDef> = {}
): Set<string> {
  const maps = (Object.values(commands) as CommandClass[]).map((command) => ({
    ...extraBaseFlags,
    ...command.baseFlags,
    ...command.flags,
  }));
  return valueTakingFlagTokensFromFlagMaps(maps);
}

/** Same token set, read from a generated oclif manifest instead of command classes. */
export function valueTakingFlagTokensFromFlagMaps(
  flagMaps: Array<Record<string, FlagDef> | undefined>
): Set<string> {
  const tokens = new Set<string>();
  for (const flags of flagMaps) {
    for (const [name, flag] of Object.entries(flags ?? {})) {
      if (!flag || flag.type === 'boolean') continue;
      for (const token of flagTokens(name, flag)) tokens.add(token);
    }
  }
  return tokens;
}
