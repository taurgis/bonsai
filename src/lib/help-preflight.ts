import { Config } from '@oclif/core';
import { buildEnvelope } from './envelope.js';
import { buildCommandNotFoundDetails } from '../hooks/command-not-found/suggest.js';

type UnknownHelpResult =
  | {
      exitCode: 2;
      kind: 'human';
      message: string;
    }
  | {
      envelope: Record<string, unknown>;
      exitCode: 2;
      kind: 'json';
    };

function commandId(parts: readonly string[]): string {
  return parts.join(':');
}

function positionalTokens(argv: readonly string[]): string[] {
  const tokens: string[] = [];
  for (const arg of argv) {
    if (arg === '--') break;
    if (arg === '--help' || arg === '--json') continue;
    if (arg.startsWith('-')) continue;
    tokens.push(arg);
  }
  return tokens;
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

  const tokens = positionalTokens(argv);
  if (tokens.length === 0) return null;

  const config = await Config.load({ root });
  if (hasValidHelpTarget(tokens, config)) return null;

  const attemptedId = commandId(tokens);
  const details = buildCommandNotFoundDetails(attemptedId, [...argv], config);
  if (argv.includes('--json')) {
    return {
      kind: 'json',
      exitCode: 2,
      envelope: buildEnvelope({
        command: details.command,
        ok: false,
        exitCode: 2,
        stderr: `${details.message}\nCode: ${details.code}`,
        data: null,
        code: details.code,
      }),
    };
  }

  return {
    kind: 'human',
    exitCode: 2,
    message: `${details.message}\nCode: ${details.code}`,
  };
}
