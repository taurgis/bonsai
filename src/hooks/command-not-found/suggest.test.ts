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
  // oclif resolves `config` to a topic; the hook reads this to keep a known topic in the displayed
  // attempt when no command suggestion exists.
  findTopic: (id: string) => (id === 'config' ? { name: 'config' } : undefined),
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

  // With topicSeparator ' ', oclif folds a typo'd command's positional args into the id
  // (`serch hello` → `serch:hello`). The suggestion must still fire, and the folded-in arg must not
  // appear in the displayed attempt.
  it('suggests the nearest command when a positional arg follows the typo', async () => {
    const msg = await runHook('serch:hello');
    expect(msg).toContain('serch is not a bonsai command.');
    expect(msg).toContain('Did you mean search?');
  });

  it('does not mangle a URL argument folded into the attempted id', async () => {
    const msg = await runHook('statuss:https://example.com/page');
    expect(msg).toContain('statuss is not a bonsai command.');
    expect(msg).toContain('Did you mean status?');
    // The `://` in the folded URL must never surface as ` //` in the message.
    expect(msg).not.toContain('//');
  });

  it('keeps a known topic in the attempt when the subcommand is unknown and unmatched', async () => {
    const msg = await runHook('config:frobnicate');
    expect(msg).toContain('config frobnicate is not a bonsai command.');
    expect(msg).not.toContain('Did you mean');
  });

  // `config set <key> <value>` takes positional args, so a subcommand typo arrives with the value
  // folded into the id (`config:sett:somevalue`). The two-segment command must still be matched and
  // the trailing value dropped from the displayed attempt.
  it('suggests a topic subcommand when a positional arg follows the subcommand typo', async () => {
    const msg = await runHook('config:sett:somevalue');
    expect(msg).toContain('config sett is not a bonsai command.');
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
