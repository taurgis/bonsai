import { describe, it, expect } from 'vitest';
import { normalizeCliErrorMessage } from './envelope.js';
import { closestOptionValue, enrichParseError } from './parse-error-ux.js';

describe('normalizeCliErrorMessage', () => {
  it('strips the oclif help suffix', () => {
    expect(normalizeCliErrorMessage('bad\nSee more help with --help')).toBe('bad');
    expect(normalizeCliErrorMessage('bad')).toBe('bad');
  });

  it('unwraps oclif Parsing --flag wrappers', () => {
    expect(
      normalizeCliErrorMessage(
        'Parsing --limit \n\tLimit must be between 1 and 100.\nSee more help with --help'
      )
    ).toBe('Limit must be between 1 and 100.');
  });
});

describe('closestOptionValue', () => {
  it('prefers edit-distance matches', () => {
    expect(closestOptionValue('fres', ['fresh', 'stale_grace'])).toBe('fresh');
  });

  it('falls back to unique prefix matches for truncated enums', () => {
    expect(closestOptionValue('stale', ['fresh', 'stale_grace', 'stale_expired'])).toEqual([
      'stale_grace',
      'stale_expired',
    ]);
  });
});

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

  it('tips that list omits section artifacts', () => {
    const err = Object.assign(
      new Error(
        'Expected --artifact-type=section to be one of: source, research_note, index\nSee more help with --help'
      ),
      {}
    );
    enrichParseError(err);
    expect(err.message).toContain('Section artifacts are omitted from list');
    expect(err.suggestions?.[0]).toContain('inspect');
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
});
