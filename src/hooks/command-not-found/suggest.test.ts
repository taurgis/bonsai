import { describe, it, expect, vi } from 'vitest';
import hook from './suggest.js';

// Minimal stand-in for the oclif Config the hook reads: the visible/hidden command split, the
// command id list, the bin name, and the topic separator that toConfiguredId uses for display.
const fakeConfig = {
  bin: 'bonsai',
  topicSeparator: ' ',
  commandIDs: ['import', 'inspect', 'list', 'prune', 'search', 'status', 'fetch', 'config:set'],
  commands: [
    { id: 'status', hidden: false },
    { id: 'search', hidden: false },
    { id: 'config:set', hidden: false },
    { id: 'fetch', hidden: true },
  ],
};

// Invoke the hook the way oclif does: `this` is the context (here only `error` is exercised), and
// the options object carries id/argv plus the config. `error` throws so we capture the message.
async function runHook(id: string): Promise<string> {
  const ctx = {
    error: vi.fn((message: string) => {
      throw new Error(message);
    }),
  };
  let captured = '';
  try {
    await (hook as any).call(ctx, { id, argv: [], config: fakeConfig, context: ctx });
  } catch (err) {
    captured = (err as Error).message;
  }
  expect(ctx.error).toHaveBeenCalledOnce();
  return captured;
}

describe('command_not_found hook', () => {
  it('suggests the nearest command for a plausible typo', async () => {
    const msg = await runHook('statuss');
    expect(msg).toContain('statuss is not a bonsai command.');
    expect(msg).toContain('Did you mean status?');
    expect(msg).toContain('Run bonsai help');
  });

  it('renders topic ids with the configured separator', async () => {
    const msg = await runHook('confg:set');
    expect(msg).toContain('confg set is not a bonsai command.');
    expect(msg).toContain('Did you mean config set?');
  });

  it('omits a suggestion when nothing is a close match', async () => {
    const msg = await runHook('frobnicate');
    expect(msg).toContain('frobnicate is not a bonsai command.');
    expect(msg).not.toContain('Did you mean');
  });

  it('never suggests a hidden command', async () => {
    // 'fetcj' is one edit from the hidden 'fetch'; the hook must skip it rather than surface a
    // command the help output intentionally hides. No visible command is within the threshold of
    // 'fetcj', so it must offer no correction at all (not just avoid naming 'fetch').
    const msg = await runHook('fetcj');
    expect(msg).not.toContain('Did you mean');
  });
});
