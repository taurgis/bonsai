import { describe, it, expect } from 'vitest';
import { isJsonMetaRequest } from './json-meta.js';

describe('isJsonMetaRequest', () => {
  it('detects --json with --help', () => {
    expect(isJsonMetaRequest(['--json', '--help'])).toBe(true);
    expect(isJsonMetaRequest(['list', '--help', '--json'])).toBe(true);
  });

  it('detects --json with --version', () => {
    expect(isJsonMetaRequest(['--version', '--json'])).toBe(true);
  });

  it('returns false for normal commands', () => {
    expect(isJsonMetaRequest(['list', '--json'])).toBe(false);
    expect(isJsonMetaRequest(['--help'])).toBe(false);
    expect(isJsonMetaRequest(['--json'])).toBe(false);
  });
});
