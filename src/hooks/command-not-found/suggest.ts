import { type Hook, toConfiguredId } from '@oclif/core';
import { closestMatch } from '../../lib/text.js';

// Nearest command must be within this edit distance to be offered as a correction. Bonsai's command
// ids are short, so 3 catches realistic typos ("statuss", "improt") without suggesting an unrelated
// command for input that resembles nothing.
const MAX_SUGGESTION_DISTANCE = 3;

/**
 * Typo-aware "command not found" handler. oclif fires this before printing its own terse error;
 * throwing here (via `this.error`) replaces that default with a more helpful message. A correction
 * is offered only when the nearest command is a close match, and it is never auto-run — the user
 * re-runs the corrected command themselves, so they learn the right syntax (clig.dev guidance).
 */
const hook: Hook<'command_not_found'> = async function (opts) {
  const hiddenIds = new Set(opts.config.commands.filter((c) => c.hidden).map((c) => c.id));
  const visibleIds = opts.config.commandIDs.filter((id) => !hiddenIds.has(id));

  const attempted = toConfiguredId(opts.id, opts.config);
  const suggestion = closestMatch(opts.id, visibleIds, MAX_SUGGESTION_DISTANCE);

  // Order so the most actionable line lands last, where the eye rests (clig.dev): the help pointer
  // is the floor, and a concrete "Did you mean …?" correction — when we have one — goes below it.
  const lines = [`${attempted} is not a ${opts.config.bin} command.`];
  lines.push(`Run ${opts.config.bin} help for a list of available commands.`);
  if (suggestion) lines.push(`Did you mean ${toConfiguredId(suggestion, opts.config)}?`);

  this.error(lines.join('\n'), { exit: 2 });
};

export default hook;
