import { describe, it, expect } from 'vitest';
import { buildEnvelope, formatErrorForJson } from './envelope.js';

describe('formatErrorForJson', () => {
  it('includes message, code, and a single suggestion', () => {
    expect(
      formatErrorForJson({
        message: 'No cached research found for URL: https://example.com/missing',
        code: 'CACHE_MISS',
        suggestions: ['Fetch and cache it first: bonsai https://example.com/missing'],
      })
    ).toBe(
      'No cached research found for URL: https://example.com/missing\nCode: CACHE_MISS\nTry this: Fetch and cache it first: bonsai https://example.com/missing'
    );
  });

  it('formats multiple suggestions as a bulleted list', () => {
    expect(
      formatErrorForJson({
        message: 'conflict',
        suggestions: ['option a', 'option b'],
      })
    ).toBe('conflict\nTry this:\n* option a\n* option b');
  });

  it('includes reference when present', () => {
    expect(
      formatErrorForJson({
        message: 'fetch failed',
        code: 'FETCH_FAILED',
        ref: 'https://example.com/docs/errors',
      })
    ).toBe('fetch failed\nCode: FETCH_FAILED\nReference: https://example.com/docs/errors');
  });
});

describe('buildEnvelope', () => {
  it('omits optional error fields on success envelopes', () => {
    expect(
      buildEnvelope({
        command: 'list',
        ok: true,
        exitCode: 0,
        stderr: '',
        data: [],
      })
    ).toEqual({
      schemaVersion: 1,
      command: 'list',
      ok: true,
      exitCode: 0,
      stdout: '',
      stderr: '',
      data: [],
    });
  });

  it('includes code and suggestions on error envelopes when provided', () => {
    expect(
      buildEnvelope({
        command: 'inspect',
        ok: false,
        exitCode: 1,
        stderr: 'miss',
        data: null,
        code: 'CACHE_MISS',
        suggestions: ['fetch it'],
      })
    ).toMatchObject({
      code: 'CACHE_MISS',
      suggestions: ['fetch it'],
    });
  });
});
