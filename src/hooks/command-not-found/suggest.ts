import { type Hook, type Interfaces, toConfiguredId } from '@oclif/core';
import { closestMatch, maxFuzzyDistance } from '../../lib/text.js';
import { emitCommandNotFoundJson } from '../../lib/cli-emit.js';
import { looksLikeSchemelessUrl } from '../../lib/research/url.js';

/**
 * The nearest visible command to a typo, plus how many leading segments of the attempted id name
 * the command. With `topicSeparator: ' '`, oclif folds every leading token of an unknown command
 * into one colon-delimited id, so `bonsai lisst extra` arrives as `lisst:extra`. Matching that whole
 * string never finds a short command, so walk prefixes longest→shortest and suggest off the closest:
 * `lisst:extra` resolves to nothing, but its prefix `lisst` resolves to `list`. The matched prefix
 * length doubles as the command-segment count, so a folded-in positional arg is dropped from display.
 */
function findSuggestion(
  segments: string[],
  commandIds: string[]
): { suggestion: string | null; commandSegments: number } {
  for (let n = segments.length; n >= 1; n--) {
    const attempted = segments.slice(0, n).join(':');
    const suggestion = closestMatch(attempted, commandIds, maxFuzzyDistance(attempted));
    if (
      suggestion === attempted &&
      n < segments.length &&
      commandIds.some((id) => id.startsWith(`${attempted}:`))
    ) {
      continue;
    }
    if (suggestion) return { suggestion, commandSegments: n };
  }
  return { suggestion: null, commandSegments: 0 };
}

/**
 * How many leading segments name the command when no suggestion exists: the known-topic chain plus
 * the first unknown segment. Keeps `config frobnicate` from rendering as the misleading bare `config`
 * (a real topic) while still dropping a positional arg from `frobnicate banana`.
 */
function topicChainLength(segments: string[], config: Interfaces.Config): number {
  let i = 0;
  while (i < segments.length - 1 && config.findTopic(segments.slice(0, i + 1).join(':'))) i++;
  return i + 1;
}

function exactZeroArgCommandPrefix(
  segments: string[],
  commandIds: string[],
  config: Interfaces.Config
): { commandId: string; extra: string } | null {
  for (let n = segments.length - 1; n >= 1; n--) {
    const candidate = segments.slice(0, n).join(':');
    if (!commandIds.includes(candidate)) continue;
    if (commandIds.some((id) => id.startsWith(`${candidate}:`))) continue;

    const command = config.commands.find((entry) => entry.id === candidate);
    const args = Object.keys(
      (command as { args?: Record<string, unknown> } | undefined)?.args ?? {}
    );
    if (args.length > 0) continue;

    const extra = segments[n];
    if (extra === undefined) continue;
    return { commandId: candidate, extra };
  }
  return null;
}

/**
 * The input as-typed when it looks like a URL missing its scheme (`example.com`,
 * `docs.nestjs.com/guide`), else null. `bonsai <url>` is the headline command, but bin/cli.mjs only
 * routes args carrying a `://` scheme to the fetch shorthand — so a scheme-less URL falls through to
 * `command_not_found`. A domain-shaped host separates a forgotten-scheme URL from an ordinary command
 * typo: `statuss` has no dot and never matches, while `config:frobnicate` fails to parse (the second
 * segment becomes a non-numeric port), so neither is misread as a URL. The same domain-shape test
 * powers normalizeUrl's "missing scheme" hint, so the two entry paths stay in lockstep.
 */
function bareUrlInput(id: string): string | null {
  return looksLikeSchemelessUrl(id) ? id : null;
}

function isJsonMode(argv: string[] | undefined): boolean {
  return (argv?.includes('--json') ?? false) || process.argv.includes('--json');
}

export function buildCommandNotFoundDetails(
  id: string,
  argv: string[] | undefined,
  config: Interfaces.Config
): {
  code: 'COMMAND_NOT_FOUND' | 'MISSING_URL_SCHEME' | 'UNEXPECTED_ARGUMENT';
  command: string;
  jsonMode: boolean;
  message: string;
  suggestions?: string[];
} {
  // Match against every loaded command id — including hidden ones that stay invokable
  // (`fetch`, plugin internals). Root `--help` hides them; typo recovery should not.
  const commandIds = config.commandIDs;

  // A scheme-less URL is the most common "not a command" mistake for this CLI, so steer the user to
  // the `bonsai <url>` shorthand with a scheme before falling back to nearest-command matching (which
  // never finds a command for a hostname). The correction is shown, never auto-run (clig.dev).
  // Flag-only argv never reaches here — normalizeArgv early-exits those as MISSING_COMMAND.
  const bareUrl = bareUrlInput(id);
  if (bareUrl) {
    const suggestion = `${config.bin} https://${bareUrl}`;
    return {
      code: 'MISSING_URL_SCHEME',
      command: bareUrl,
      jsonMode: isJsonMode(argv),
      message: [
        `${bareUrl} is not a ${config.bin} command.`,
        `Run ${config.bin} help for a list of available commands.`,
        `Did you mean ${suggestion}? URLs need an http:// or https:// scheme.`,
      ].join('\n'),
      suggestions: [suggestion],
    };
  }

  const segments = id.split(':');
  const unexpected = exactZeroArgCommandPrefix(segments, commandIds, config);
  if (unexpected) {
    const command = toConfiguredId(unexpected.commandId, config);
    return {
      code: 'UNEXPECTED_ARGUMENT',
      command,
      jsonMode: isJsonMode(argv),
      message: [
        `Unexpected argument: ${unexpected.extra}`,
        `Run ${config.bin} ${command} --help for usage.`,
      ].join('\n'),
    };
  }

  const { suggestion, commandSegments } = findSuggestion(segments, commandIds);
  // Show only the segments that name the command, never the positional args oclif folded into the id
  // (which would otherwise glue the arg on and turn `://` into ` //`).
  const displaySegments = commandSegments || topicChainLength(segments, config);
  const attempted = toConfiguredId(segments.slice(0, displaySegments).join(':'), config);

  // Order so the most actionable line lands last, where the eye rests (clig.dev): the help pointer
  // is the floor, and a concrete "Did you mean …?" correction — when we have one — goes below it.
  const lines = [`${attempted} is not a ${config.bin} command.`];
  lines.push(`Run ${config.bin} help for a list of available commands.`);
  const suggestions = suggestion
    ? [`${config.bin} ${toConfiguredId(suggestion, config)}`]
    : undefined;
  if (suggestion) lines.push(`Did you mean ${toConfiguredId(suggestion, config)}?`);

  return {
    code: 'COMMAND_NOT_FOUND',
    command: attempted,
    jsonMode: isJsonMode(argv),
    message: lines.join('\n'),
    suggestions,
  };
}

/**
 * Typo-aware "command not found" handler. oclif fires this before printing its own terse error;
 * throwing here (via `this.error`) replaces that default with a more helpful message. A correction
 * is offered only when the nearest command is a close match, and it is never auto-run — the user
 * re-runs the corrected command themselves, so they learn the right syntax (clig.dev guidance).
 */
const hook: Hook<'command_not_found'> = async function (opts) {
  const details = buildCommandNotFoundDetails(opts.id, opts.argv, opts.config);
  if (details.jsonMode) {
    return emitCommandNotFoundJson({
      command: details.command,
      message: details.message,
      code: details.code,
      suggestions: details.suggestions,
    });
  }
  // Hook context typings omit `suggestions` even though CLIError accepts them; cast keeps the
  // human pretty-print "Try this:" lines aligned with the JSON envelope.
  this.error(details.message, {
    exit: 2,
    code: details.code,
    suggestions: details.suggestions,
  } as { exit: number; code: string; suggestions?: string[] });
};

export default hook;
