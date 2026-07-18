import { type Hook, type Interfaces, toConfiguredId } from '@oclif/core';
import { closestMatch, maxFuzzyDistance } from '../../lib/text.js';
import { buildCliErrorEnvelope } from '../../lib/envelope.js';
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
  visibleIds: string[]
): { suggestion: string | null; commandSegments: number } {
  for (let n = segments.length; n >= 1; n--) {
    const attempted = segments.slice(0, n).join(':');
    const suggestion = closestMatch(attempted, visibleIds, maxFuzzyDistance(attempted));
    if (
      suggestion === attempted &&
      n < segments.length &&
      visibleIds.some((id) => id.startsWith(`${attempted}:`))
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
  visibleIds: string[],
  config: Interfaces.Config
): { commandId: string; extra: string } | null {
  for (let n = segments.length - 1; n >= 1; n--) {
    const candidate = segments.slice(0, n).join(':');
    if (!visibleIds.includes(candidate)) continue;
    if (visibleIds.some((id) => id.startsWith(`${candidate}:`))) continue;

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
  return argv?.includes('--json') ?? false;
}

function emitJsonError(
  command: string,
  message: string,
  code: 'COMMAND_NOT_FOUND' | 'MISSING_URL_SCHEME' | 'UNEXPECTED_ARGUMENT',
  suggestions?: string[]
): Record<string, unknown> {
  const envelope = buildCliErrorEnvelope({ command, message, code, suggestions });
  process.exitCode = 2;
  console.log(JSON.stringify(envelope, null, 2));
  return envelope;
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
  const hiddenIds = new Set(config.commands.filter((c) => c.hidden).map((c) => c.id));
  // `fetch` is hidden so the root command list stays focused on the URL shorthand, but it remains a
  // supported entry point (`bonsai fetch <url>`, `bonsai help fetch`). Include it in typo matching so
  // `fetsh`/`fetchh` get a correction instead of a dead-end COMMAND_NOT_FOUND (clig.dev).
  const suggestableHidden = new Set(['fetch']);
  const visibleIds = config.commandIDs.filter(
    (commandId) => !hiddenIds.has(commandId) || suggestableHidden.has(commandId)
  );

  // A scheme-less URL is the most common "not a command" mistake for this CLI, so steer the user to
  // the `bonsai <url>` shorthand with a scheme before falling back to nearest-command matching (which
  // never finds a command for a hostname). The correction is shown, never auto-run (clig.dev).
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
  const unexpected = exactZeroArgCommandPrefix(segments, visibleIds, config);
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

  const { suggestion, commandSegments } = findSuggestion(segments, visibleIds);
  // Show only the segments that name the command, never the positional args oclif folded into the id
  // (which would otherwise glue the arg on and turn `://` into ` //`).
  const displaySegments = commandSegments || topicChainLength(segments, config);
  const attempted = toConfiguredId(segments.slice(0, displaySegments).join(':'), config);

  // Order so the most actionable line lands last, where the eye rests (clig.dev): the help pointer
  // is the floor, and a concrete "Did you mean …?" correction — when we have one — goes below it.
  const lines = [`${attempted} is not a ${config.bin} command.`];
  lines.push(`Run ${config.bin} help for a list of available commands.`);
  let suggestions = suggestion
    ? [`${config.bin} ${toConfiguredId(suggestion, config)}`]
    : undefined;
  if (suggestion) {
    const displaySuggestion = toConfiguredId(suggestion, config);
    lines.push(`Did you mean ${displaySuggestion}?`);
    // fetch is usually invoked as a bare URL; steer typos toward that headline form too.
    if (suggestion === 'fetch') {
      lines.push(`Or pass a URL directly: ${config.bin} https://example.com`);
      suggestions = [`${config.bin} https://example.com`, `${config.bin} help fetch`];
    }
  }

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
    return emitJsonError(details.command, details.message, details.code, details.suggestions);
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
