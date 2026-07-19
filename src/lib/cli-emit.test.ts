import { describe, it, expect, vi, afterEach } from 'vitest';
import { writeCommandNotFoundJson } from './cli-emit.js';
import { EXIT_USAGE } from './cli-error-policy.js';

describe('cli-emit', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it('prints a command-not-found JSON envelope and sets EXIT_USAGE', () => {
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    });

    const envelope = writeCommandNotFoundJson({
      command: 'bonsai',
      message: 'Command feth not found.',
      code: 'COMMAND_NOT_FOUND',
      suggestions: ['Did you mean fetch?'],
    });

    expect(process.exitCode).toBe(EXIT_USAGE);
    expect(envelope).toMatchObject({
      ok: false,
      code: 'COMMAND_NOT_FOUND',
      exitCode: EXIT_USAGE,
    });
    expect(JSON.parse(logs.join('\n'))).toMatchObject({
      code: 'COMMAND_NOT_FOUND',
      suggestions: ['Did you mean fetch?'],
    });
  });
});
