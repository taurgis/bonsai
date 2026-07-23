import type { SetupAgent } from '../cli-result-types.js';

/** Every agent `setup` currently knows how to install a SessionStart hook for. */
export const SETUP_AGENTS: readonly SetupAgent[] = ['claude-code', 'codex'];

/** Where a SessionStart hook lives for one agent, and how Bonsai's entry is shaped. */
export interface SetupAgentTarget {
  /** Hook-config file path, relative to the project root or the user's home directory. */
  relativePath: string;
  eventName: string;
  matcher: string;
  timeout: number;
}

// Both agents accept plain stdout as SessionStart context and share the same `source` matcher
// values (startup/resume/clear/compact) — see the cached docs at
// developers.openai.com/codex/hooks#sessionstart (.bonsai/research/4f69debe...) and
// code.claude.com/docs/en/hooks (.bonsai/research/20106b0f3bee09dd540039d6a1a5294fbfbe0ae0b182affd4138cf3caa31e0c6.md,
// imported rather than fetched — Bonsai's own fetch times out on this host in this environment).
const SESSION_START: Omit<SetupAgentTarget, 'relativePath'> = {
  eventName: 'SessionStart',
  matcher: 'startup|resume|clear|compact',
  timeout: 10,
};

/** Subcommand `setup` invokes at session start; appended to the resolved bin command. */
export const SETUP_HOOK_COMMAND_SUFFIX = 'context';

/** Tag value stamped on every handler `setup` installs — see {@link SessionStartHookSpec.managedBy}. */
export const SETUP_HOOK_MANAGED_BY = 'bonsai';

export const SETUP_AGENT_TARGETS: Record<SetupAgent, SetupAgentTarget> = {
  'claude-code': { ...SESSION_START, relativePath: '.claude/settings.json' },
  codex: { ...SESSION_START, relativePath: '.codex/hooks.json' },
};
