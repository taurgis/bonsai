import { describe, it, expect } from 'vitest';
import { planSessionStartHookInstall, InvalidHookFileError } from './hook-file-io.js';
import type { SessionStartHookSpec } from './hook-file-io.js';

const spec: SessionStartHookSpec = {
  eventName: 'SessionStart',
  matcher: 'startup|resume|clear|compact',
  command: 'bonsai context',
  timeout: 10,
  managedBy: 'bonsai',
};

describe('planSessionStartHookInstall', () => {
  it('creates a new hook file from scratch, tagging the handler as Bonsai-managed', () => {
    const plan = planSessionStartHookInstall(null, spec);
    expect(plan.status).toBe('installed');
    expect(JSON.parse(plan.content)).toEqual({
      hooks: {
        SessionStart: [
          {
            matcher: spec.matcher,
            hooks: [
              { type: 'command', command: 'bonsai context', timeout: 10, managedBy: 'bonsai' },
            ],
          },
        ],
      },
    });
  });

  it('appends alongside unrelated existing hooks without touching them', () => {
    const existing = JSON.stringify({
      hooks: {
        PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo hi' }] }],
      },
    });
    const plan = planSessionStartHookInstall(existing, spec);
    expect(plan.status).toBe('installed');
    const parsed = JSON.parse(plan.content);
    expect(parsed.hooks.PreToolUse).toEqual([
      { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo hi' }] },
    ]);
    expect(parsed.hooks.SessionStart).toHaveLength(1);
  });

  it('is idempotent: re-running with the same command returns the original bytes unchanged', () => {
    const first = planSessionStartHookInstall(null, spec);
    const second = planSessionStartHookInstall(first.content, spec);
    expect(second.status).toBe('unchanged');
    expect(second.content).toBe(first.content);
  });

  it('repairs a stale command in place, leaving the matcher and other hooks untouched', () => {
    const first = planSessionStartHookInstall(null, spec);
    const repaired = planSessionStartHookInstall(first.content, {
      ...spec,
      command: 'node "/new/path/cli.mjs" context',
    });
    expect(repaired.status).toBe('repaired');
    const parsed = JSON.parse(repaired.content);
    expect(parsed.hooks.SessionStart[0].hooks[0].command).toBe('node "/new/path/cli.mjs" context');
    expect(parsed.hooks.SessionStart[0].hooks[0].managedBy).toBe('bonsai');
    expect(parsed.hooks.SessionStart[0].matcher).toBe(spec.matcher);
  });

  it('does not mistake an unrelated SessionStart hook for a Bonsai entry', () => {
    const existing = JSON.stringify({
      hooks: {
        SessionStart: [
          { matcher: 'startup', hooks: [{ type: 'command', command: './load-context.sh' }] },
        ],
      },
    });
    const plan = planSessionStartHookInstall(existing, spec);
    expect(plan.status).toBe('installed');
    const parsed = JSON.parse(plan.content);
    expect(parsed.hooks.SessionStart).toHaveLength(2);
    expect(parsed.hooks.SessionStart[0].hooks[0].command).toBe('./load-context.sh');
  });

  it('does not mistake an untagged hook for a Bonsai entry even when its command ends in the same word', () => {
    // A user's own hook (no `managedBy` tag) that happens to end in " context" — e.g. a wrapped
    // command like `echo ready && bonsai context` — must never be identified as Bonsai's own entry
    // by command text alone. Only the explicit `managedBy` tag does that now.
    const existing = JSON.stringify({
      hooks: {
        SessionStart: [
          {
            matcher: 'startup',
            hooks: [{ type: 'command', command: 'echo ready && bonsai context' }],
          },
        ],
      },
    });
    const plan = planSessionStartHookInstall(existing, spec);
    expect(plan.status).toBe('installed');
    const parsed = JSON.parse(plan.content);
    expect(parsed.hooks.SessionStart).toHaveLength(2);
    expect(parsed.hooks.SessionStart[0].hooks[0].command).toBe('echo ready && bonsai context');
    expect(parsed.hooks.SessionStart[0].hooks[0].managedBy).toBeUndefined();
    expect(parsed.hooks.SessionStart[1].hooks[0].managedBy).toBe('bonsai');
  });

  it('throws InvalidHookFileError on malformed JSON rather than overwriting it', () => {
    expect(() => planSessionStartHookInstall('{ not valid json', spec)).toThrow(
      InvalidHookFileError
    );
  });

  it('throws InvalidHookFileError when the top-level value is not an object', () => {
    expect(() => planSessionStartHookInstall('[1, 2, 3]', spec)).toThrow(InvalidHookFileError);
  });
});
