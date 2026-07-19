import { describe, expect, it } from 'vitest';
import { enrichErrorForDisplay, exitCodeOf, prepareCliError } from './cli-error-policy.js';

describe('cli-error-policy', () => {
  it('reads exit codes from oclif.exit then exitCode', () => {
    expect(exitCodeOf({ oclif: { exit: 2 } })).toBe(2);
    expect(exitCodeOf({ exitCode: 5 })).toBe(5);
    expect(exitCodeOf({})).toBe(1);
  });

  it('supplies fallback suggestions for usage codes', () => {
    expect(
      prepareCliError(
        { message: 'bad', code: 'UNKNOWN_FLAG', oclif: { exit: 2 } },
        { bin: 'bonsai', command: 'list' }
      ).suggestions
    ).toEqual(['Check usage: bonsai list --help']);
    expect(
      prepareCliError(
        { message: 'bad', code: 'INVALID_DURATION', oclif: { exit: 2 } },
        { bin: 'bonsai', command: 'bonsai' }
      ).suggestions
    ).toEqual(['Use a whole number plus a unit, e.g. 2h, 7d, or 6m.']);
  });

  it('preserves explicit suggestions when preparing errors', () => {
    const prepared = prepareCliError(
      { message: 'bad', code: 'UNKNOWN_FLAG', suggestions: ['custom tip'], oclif: { exit: 2 } },
      { bin: 'bonsai', command: 'list' }
    );
    expect(prepared.suggestions).toEqual(['custom tip']);
    expect(prepared.stderr).toContain('Code: UNKNOWN_FLAG');
    expect(prepared.stderr).toContain('Try this: custom tip');
  });

  it('enriches display errors with code and fallbacks', () => {
    const err: { message: string; code?: string; suggestions?: string[] } = {
      message: 'Flag --x expects a value',
    };
    enrichErrorForDisplay(err, { bin: 'bonsai', command: 'fetch' });
    expect(err.code).toBe('MISSING_FLAG_VALUE');
    expect(err.suggestions?.[0]).toContain('bonsai fetch --help');
  });
});
