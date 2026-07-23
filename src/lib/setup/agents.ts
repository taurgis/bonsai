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
// developers.openai.com/codex/hooks#sessionstart and code.claude.com/docs/en/hooks.
const SESSION_START: Omit<SetupAgentTarget, 'relativePath'> = {
  eventName: 'SessionStart',
  matcher: 'startup|resume|clear|compact',
  timeout: 10,
};

/** Every command Bonsai's `setup` writes ends in this suffix — see {@link SessionStartHookSpec.markerSuffix}. */
export const SETUP_HOOK_MARKER_SUFFIX = 'context';

export const SETUP_AGENT_TARGETS: Record<SetupAgent, SetupAgentTarget> = {
  'claude-code': { ...SESSION_START, relativePath: '.claude/settings.json' },
  codex: { ...SESSION_START, relativePath: '.codex/hooks.json' },
};
