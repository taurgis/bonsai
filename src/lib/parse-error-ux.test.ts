import { describe, it, expect } from 'vitest';
import { enrichParseError } from './parse-error-ux.js';

describe('enrichParseError', () => {
  it('suggests the nearest flag for a typo', () => {
    const err = Object.assign(new Error('Nonexistent flag: --topc'), {
      flags: ['--topc'],
      parse: {
        input: {
          flags: {
            topic: { char: 't' },
            'read-only': { aliases: ['plan'] },
          },
        },
      },
    });
    enrichParseError(err);
    expect(err.message).toContain('Did you mean --topic?');
    expect(err.suggestions).toContain('--topic');
  });

  it('suggests truncated freshness values', () => {
    const err = Object.assign(
      new Error(
        'Expected --freshness=stale to be one of: fresh, stale_grace, stale_expired\nSee more help with --help'
      ),
      {}
    );
    enrichParseError(err);
    expect(err.message).toMatch(/Did you mean stale_grace or stale_expired\?/);
  });

  it('unwraps Parsing --flag wrappers before suggesting', () => {
    const err = Object.assign(
      new Error('Parsing --limit \n\tLimit must be between 1 and 100.\nSee more help with --help'),
      {}
    );
    enrichParseError(err);
    expect(err.message).toBe('Limit must be between 1 and 100.');
  });
});
