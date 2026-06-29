import { describe, it, expect, vi } from 'vitest';
import hook from './suggest.js';

// Minimal stand-in for the oclif Config the hook reads: the visible/hidden command split, the
// command id list, the bin name, and the topic separator that toConfiguredId uses for display.
const fakeConfig = {
  bin: 'bonsai',
  topicSeparator: ' ',
  commandIDs: [
    'import',
    'inspect',
    'list',
    'prune',
    'status',
    'fetch',
    'config',
    'config:get',
    'config:set',
  ],
  commands: [
    { id: 'import', hidden: false, args: { url: {} } },
    { id: 'inspect', hidden: false, args: { url: {} } },
    { id: 'list', hidden: false, args: {} },
    { id: 'prune', hidden: false, args: {} },
    { id: 'status', hidden: false },
    { id: 'config', hidden: false, args: {} },
    { id: 'config:get', hidden: false },
    { id: 'config:set', hidden: false },
    { id: 'fetch', hidden: true },
  ],
  // oclif resolves `config` to a topic; the hook reads this to keep a known topic in the displayed
  // attempt when no command suggestion exists.
  findTopic: (id: string) => (id === 'config' ? { name: 'config' } : undefined),
};

// Invoke the hook the way oclif does: `this` is the context (here only `error` is exercised), and
// the options object carries id/argv plus the config. `error` throws so we capture the message.
async function runHook(id: string, argv: string[] = []): Promise<string> {
  const ctx = {
    error: vi.fn((message: string) => {
      throw new Error(message);
    }),
  };
  let captured = '';
  try {
    await (hook as any).call(ctx, { id, argv, config: fakeConfig, context: ctx });
  } catch (err) {
    captured = (err as Error).message;
  }
  expect(ctx.error).toHaveBeenCalledOnce();
  return captured;
}

async function runJsonHook(id: string, argv: string[] = ['--json']): Promise<any> {
  const writes: string[] = [];
  const spy = vi.spyOn(console, 'log').mockImplementation((value: string) => {
    writes.push(value);
  });
  const ctx = {
    error: vi.fn((message: string) => {
      throw new Error(message);
    }),
  };
  const previousExitCode = process.exitCode;
  try {
    const result = await (hook as any).call(ctx, { id, argv, config: fakeConfig, context: ctx });
    expect(ctx.error).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(2);
    expect(result).toEqual(JSON.parse(writes.join('\n')));
    return result;
  } finally {
    process.exitCode = previousExitCode;
    spy.mockRestore();
  }
}

describe('command_not_found hook', () => {
  it('suggests the nearest command for a plausible typo', async () => {
    const msg = await runHook('statuss');
    expect(msg).toContain('statuss is not a bonsai command.');
    expect(msg).toContain('Did you mean status?');
    expect(msg).toContain('Run bonsai help');
  });

  it('emits the standard JSON error envelope when --json is present', async () => {
    const envelope = await runJsonHook('lisst');
    expect(envelope).toMatchObject({
      schemaVersion: 1,
      command: 'lisst',
      ok: false,
      exitCode: 2,
      code: 'COMMAND_NOT_FOUND',
      stdout: '',
      data: null,
    });
    expect(envelope.stderr).toContain('Did you mean list?');
    expect(envelope.stderr).toContain('Code: COMMAND_NOT_FOUND');
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
    const msg = await runHook('lisst:extra');
    expect(msg).toContain('lisst is not a bonsai command.');
    expect(msg).toContain('Did you mean list?');
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

  it('does not suggest unrelated commands for very short input', async () => {
    const msg = await runHook('wat');
    expect(msg).toContain('wat is not a bonsai command.');
    expect(msg).not.toContain('Did you mean');
  });

  it('does not suggest unrelated commands for very short input in JSON mode', async () => {
    const envelope = await runJsonHook('wat');
    expect(envelope).toMatchObject({
      command: 'wat',
      ok: false,
      exitCode: 2,
      code: 'COMMAND_NOT_FOUND',
    });
    expect(envelope.stderr).not.toContain('Did you mean');
    expect(envelope.stderr).toContain('Code: COMMAND_NOT_FOUND');
  });

  it('reports folded extra tokens after a zero-arg command as unexpected arguments', async () => {
    const msg = await runHook('list:extra');
    expect(msg).toContain('Unexpected argument: extra');
    expect(msg).toContain('Run bonsai list --help for usage.');
    expect(msg).not.toContain('is not a bonsai command');
  });

  it('emits a JSON envelope for folded extra tokens after a zero-arg command', async () => {
    const envelope = await runJsonHook('list:extra');
    expect(envelope).toMatchObject({
      command: 'list',
      ok: false,
      exitCode: 2,
      code: 'UNEXPECTED_ARGUMENT',
    });
    expect(envelope.stderr).toContain('Unexpected argument: extra');
    expect(envelope.stderr).toContain('Code: UNEXPECTED_ARGUMENT');
  });

  it('keeps topic subcommand typos on the command-not-found path', async () => {
    const msg = await runHook('config:gett');
    expect(msg).toContain('config gett is not a bonsai command.');
    expect(msg).toContain('Did you mean config get?');
    expect(msg).not.toContain('Unexpected argument');
  });

  // `bonsai <url>` is the headline command, but bin/cli.mjs only routes args with a `://` scheme to
  // it, so a scheme-less URL reaches this hook. It must point back at the shorthand with a scheme.
  it('suggests the URL shorthand for a scheme-less hostname', async () => {
    const msg = await runHook('example.com');
    expect(msg).toContain('example.com is not a bonsai command.');
    expect(msg).toContain('Did you mean bonsai https://example.com?');
    expect(msg).toContain('http:// or https:// scheme');
  });

  it('emits a JSON error envelope for a scheme-less URL when --json is present', async () => {
    const envelope = await runJsonHook('example.com');
    expect(envelope).toMatchObject({
      command: 'example.com',
      ok: false,
      exitCode: 2,
      code: 'MISSING_URL_SCHEME',
      stdout: '',
      data: null,
    });
    expect(envelope.stderr).toContain('Did you mean bonsai https://example.com?');
    expect(envelope.stderr).toContain('Code: MISSING_URL_SCHEME');
  });

  it('suggests the URL shorthand for a scheme-less host with a path', async () => {
    const msg = await runHook('docs.nestjs.com/guide');
    expect(msg).toContain('Did you mean bonsai https://docs.nestjs.com/guide?');
  });

  // A port pushes the input through the URL parser's host+port branch (not host-only); the colon
  // must not be mistaken for a topic separator, and the dotted host still marks it as a URL.
  it('suggests the URL shorthand for a scheme-less host with a port and path', async () => {
    const msg = await runHook('example.com:8080/path');
    expect(msg).toContain('Did you mean bonsai https://example.com:8080/path?');
  });

  // A bare IPv4 is a valid scheme-less URL and should get the same shorthand hint.
  it('suggests the URL shorthand for a bare IPv4 host', async () => {
    const msg = await runHook('93.184.216.34');
    expect(msg).toContain('Did you mean bonsai https://93.184.216.34?');
  });

  // A dotless token is an ordinary command typo, not a forgotten-scheme URL, so the URL hint must
  // not fire and the nearest-command path must still own the suggestion.
  it('does not offer the URL hint for a dotless command typo', async () => {
    const msg = await runHook('statuss');
    expect(msg).not.toContain('https://');
    expect(msg).toContain('Did you mean status?');
  });

  // The URL parser accepts a leading-dot filename or a relative path as a "host", but neither is a
  // real domain — suggesting `https://.env` would be nonsense, so the hint must not fire.
  it.each(['.env', './scripts/build', '...'])(
    'does not offer the URL hint for non-domain token %j',
    async (token) => {
      const msg = await runHook(token);
      expect(msg).not.toContain('https://');
    }
  );

  it('never suggests a hidden command', async () => {
    // 'fetcj' is one edit from the hidden 'fetch'; the hook must skip it rather than surface a
    // command the help output intentionally hides. No visible command is within the threshold of
    // 'fetcj', so it must offer no correction at all (not just avoid naming 'fetch').
    const msg = await runHook('fetcj');
    expect(msg).not.toContain('Did you mean');
  });
});
