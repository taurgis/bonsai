import { describe, expect, it } from 'vitest';
import { buildNextLimitCommand } from './next-command.js';

describe('buildNextLimitCommand', () => {
  it('appends --limit when the original invocation had none', () => {
    expect(buildNextLimitCommand('bonsai', 'list', ['--tags', 'react'], 20)).toBe(
      'bonsai list --tags react --limit 20'
    );
  });

  it('replaces an existing --limit <value> pair rather than appending a duplicate', () => {
    expect(buildNextLimitCommand('bonsai', 'list', ['--limit', '2', '--tags', 'react'], 20)).toBe(
      'bonsai list --tags react --limit 20'
    );
  });

  it('replaces an existing --limit=value form', () => {
    expect(buildNextLimitCommand('bonsai', 'search', ['--limit=5', '--query', 'x'], 20)).toBe(
      'bonsai search --query x --limit 20'
    );
  });

  it('drops the hidden --identity flag from the bare-invocation rewrite', () => {
    expect(buildNextLimitCommand('bonsai', 'list', ['--identity'], 20)).toBe(
      'bonsai list --limit 20'
    );
  });

  it('quotes tokens containing spaces or shell-meaningful characters', () => {
    expect(buildNextLimitCommand('bonsai', 'search', ['--query', 'suspense boundary'], 20)).toBe(
      'bonsai search --query "suspense boundary" --limit 20'
    );
    expect(buildNextLimitCommand('bonsai', 'list', ['--url', 'https://react.dev/*'], 20)).toBe(
      'bonsai list --url "https://react.dev/*" --limit 20'
    );
  });

  it('escapes embedded double quotes and backslashes in a quoted token', () => {
    expect(buildNextLimitCommand('bonsai', 'search', ['--query', 'a"b\\c'], 20)).toBe(
      'bonsai search --query "a\\"b\\\\c" --limit 20'
    );
  });

  it('preserves other flags like --json/--full untouched', () => {
    expect(
      buildNextLimitCommand('bonsai', 'list', ['--full', '--json', '--tags', 'node'], 20)
    ).toBe('bonsai list --full --json --tags node --limit 20');
  });
});
