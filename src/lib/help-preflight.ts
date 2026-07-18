import { Config } from '@oclif/core';
import { positionalArgvTokens } from './argv.js';
import { buildCliErrorEnvelope } from './envelope.js';
import { buildCommandNotFoundDetails } from '../hooks/command-not-found/suggest.js';

/** Always an envelope — human and JSON share one formatted stderr (Code + Try this). */
export type UnknownHelpResult = {
  exitCode: 2;
  envelope: Record<string, unknown>;
  json: boolean;
};

function commandId(parts: readonly string[]): string {
  return parts.join(':');
}

function commandPrefixLength(tokens: readonly string[], config: Config): number {
  let longest = 0;
  for (let n = 1; n <= tokens.length; n++) {
    if (config.commandIDs.includes(commandId(tokens.slice(0, n)))) longest = n;
  }
  return longest;
}

function branchPrefixLength(tokens: readonly string[], config: Config): number {
  let longest = 0;
  for (let n = 1; n <= tokens.length; n++) {
    const id = commandId(tokens.slice(0, n));
    if (config.commandIDs.some((command) => command.startsWith(`${id}:`))) longest = n;
  }
  return longest;
}

function hasValidHelpTarget(tokens: readonly string[], config: Config): boolean {
  const commandLength = commandPrefixLength(tokens, config);
  const branchLength = branchPrefixLength(tokens, config);

  if (commandLength === tokens.length || branchLength === tokens.length) return true;
  if (branchLength > 0 && tokens.length > branchLength) {
    return commandLength > branchLength;
  }
  return commandLength > 0;
}

/**
 * oclif resolves help before its command_not_found hook, so `bonsai config gett --help` otherwise
 * falls back to a terse framework error. Catch that narrow case and reuse the normal typo guidance.
 */
export async function tryUnknownHelpOutput(
  argv: readonly string[],
  root: string
): Promise<UnknownHelpResult | null> {
  if (!argv.includes('--help')) return null;

  const tokens = positionalArgvTokens(argv);
  if (tokens.length === 0) return null;

  const config = await Config.load({ root });
  if (hasValidHelpTarget(tokens, config)) return null;

  const attemptedId = commandId(tokens);
  const details = buildCommandNotFoundDetails(attemptedId, [...argv], config);
  return {
    exitCode: 2,
    json: argv.includes('--json'),
    envelope: buildCliErrorEnvelope({
      command: details.command,
      message: details.message,
      code: details.code,
      suggestions: details.suggestions,
    }),
  };
}
