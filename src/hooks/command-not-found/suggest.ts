import { type Hook, type Interfaces, toConfiguredId } from '@oclif/core';
import { closestMatch } from '../../lib/text.js';

// Nearest command must be within this edit distance to be offered as a correction. Bonsai's command
// ids are short, so 3 catches realistic typos ("statuss", "improt") without suggesting an unrelated
// command for input that resembles nothing.
const MAX_SUGGESTION_DISTANCE = 3;

/**
 * The nearest visible command to a typo, plus how many leading segments of the attempted id name
 * the command. With `topicSeparator: ' '`, oclif folds every leading token of an unknown command
 * into one colon-delimited id, so `bonsai serch hello` arrives as `serch:hello`. Matching that whole
 * string never finds a short command, so walk prefixes longest→shortest and suggest off the closest:
 * `serch:hello` resolves to nothing, but its prefix `serch` resolves to `search`. The matched prefix
 * length doubles as the command-segment count, so a folded-in positional arg is dropped from display.
 */
function findSuggestion(
  segments: string[],
  visibleIds: string[]
): { suggestion: string | null; commandSegments: number } {
  for (let n = segments.length; n >= 1; n--) {
    const suggestion = closestMatch(
      segments.slice(0, n).join(':'),
      visibleIds,
      MAX_SUGGESTION_DISTANCE
    );
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

// Dot-separated, non-empty labels: a real domain (`docs.nestjs.com`) or IPv4 (`192.168.1.1`). The
// URL parser also accepts a leading-dot filename (`.env`) or a relative path (`./x`) as a "host",
// whose suggestion would be a nonsense `https://.env`; requiring well-formed labels rejects those.
// Anchored with no overlapping quantifiers, so it is ReDoS-safe on the (already length-bounded) host.
const DOMAIN_OR_IPV4 = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

/**
 * The input as-typed when it looks like a URL missing its scheme (`example.com`,
 * `docs.nestjs.com/guide`), else null. `bonsai <url>` is the headline command, but bin/cli.mjs only
 * routes args carrying a `://` scheme to the fetch shorthand — so a scheme-less URL falls through to
 * `command_not_found`. A domain-shaped host separates a forgotten-scheme URL from an ordinary command
 * typo: `statuss` has no dot and never matches, while `config:frobnicate` fails to parse (the second
 * segment becomes a non-numeric port), so neither is misread as a URL.
 */
function bareUrlInput(id: string): string | null {
  if (id.includes('://')) return null;
  let hostname: string;
  try {
    hostname = new URL(`https://${id}`).hostname;
  } catch {
    return null;
  }
  return DOMAIN_OR_IPV4.test(hostname) ? id : null;
}

/**
 * Typo-aware "command not found" handler. oclif fires this before printing its own terse error;
 * throwing here (via `this.error`) replaces that default with a more helpful message. A correction
 * is offered only when the nearest command is a close match, and it is never auto-run — the user
 * re-runs the corrected command themselves, so they learn the right syntax (clig.dev guidance).
 */
const hook: Hook<'command_not_found'> = async function (opts) {
  const hiddenIds = new Set(opts.config.commands.filter((c) => c.hidden).map((c) => c.id));
  const visibleIds = opts.config.commandIDs.filter((id) => !hiddenIds.has(id));

  // A scheme-less URL is the most common "not a command" mistake for this CLI, so steer the user to
  // the `bonsai <url>` shorthand with a scheme before falling back to nearest-command matching (which
  // never finds a command for a hostname). The correction is shown, never auto-run (clig.dev).
  const bareUrl = bareUrlInput(opts.id);
  if (bareUrl) {
    this.error(
      [
        `${bareUrl} is not a ${opts.config.bin} command.`,
        `Run ${opts.config.bin} help for a list of available commands.`,
        `Did you mean ${opts.config.bin} https://${bareUrl}? URLs need an http:// or https:// scheme.`,
      ].join('\n'),
      { exit: 2 }
    );
  }

  const segments = opts.id.split(':');
  const { suggestion, commandSegments } = findSuggestion(segments, visibleIds);
  // Show only the segments that name the command, never the positional args oclif folded into the id
  // (which would otherwise glue the arg on and turn `://` into ` //`).
  const displaySegments = commandSegments || topicChainLength(segments, opts.config);
  const attempted = toConfiguredId(segments.slice(0, displaySegments).join(':'), opts.config);

  // Order so the most actionable line lands last, where the eye rests (clig.dev): the help pointer
  // is the floor, and a concrete "Did you mean …?" correction — when we have one — goes below it.
  const lines = [`${attempted} is not a ${opts.config.bin} command.`];
  lines.push(`Run ${opts.config.bin} help for a list of available commands.`);
  if (suggestion) lines.push(`Did you mean ${toConfiguredId(suggestion, opts.config)}?`);

  this.error(lines.join('\n'), { exit: 2 });
};

export default hook;
