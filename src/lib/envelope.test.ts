import { describe, it, expect } from 'vitest';
import {
  buildEnvelope,
  enrichCacheMissEnvelope,
  enrichRowErrorEnvelope,
  formatErrorForJson,
  normalizeCliErrorMessage,
  stableErrorCodeFrom,
} from './envelope.js';

describe('stableErrorCodeFrom', () => {
  it('prefers an explicit code on the error', () => {
    expect(stableErrorCodeFrom({ code: 'CACHE_MISS' })).toBe('CACHE_MISS');
  });

  it('maps oclif parse error class names', () => {
    expect(stableErrorCodeFrom({ constructor: { name: 'RequiredArgsError' } })).toBe(
      'MISSING_ARGUMENT'
    );
    expect(stableErrorCodeFrom({ constructor: { name: 'FlagInvalidOptionError' } })).toBe(
      'INVALID_FLAG_VALUE'
    );
    expect(stableErrorCodeFrom({ constructor: { name: 'NonExistentFlagsError' } })).toBe(
      'UNKNOWN_FLAG'
    );
    expect(stableErrorCodeFrom({ constructor: { name: 'ArgInvalidOptionError' } })).toBe(
      'INVALID_FLAG_VALUE'
    );
    expect(stableErrorCodeFrom({ constructor: { name: 'UnexpectedArgsError' } })).toBe(
      'UNEXPECTED_ARGUMENT'
    );
  });

  it('maps the class-less "flag expects a value" error by its message', () => {
    expect(stableErrorCodeFrom({ message: 'Flag --domain expects a value' })).toBe(
      'MISSING_FLAG_VALUE'
    );
  });

  it('maps the options-flag "expects one of these values" variant', () => {
    expect(
      stableErrorCodeFrom({
        message: 'Flag --artifact-type expects one of these values: source, research_note',
      })
    ).toBe('MISSING_FLAG_VALUE');
  });

  it('maps the class-less "flag can only be specified once" error by its message', () => {
    expect(stableErrorCodeFrom({ message: 'Flag --topic can only be specified once' })).toBe(
      'DUPLICATE_FLAG'
    );
  });

  it('returns undefined when nothing maps', () => {
    expect(stableErrorCodeFrom({ message: 'boom' })).toBeUndefined();
    expect(stableErrorCodeFrom(null)).toBeUndefined();
  });
});

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

describe('formatErrorForJson', () => {
  it('formats code, suggestions, and ref like human pretty-print', () => {
    expect(
      formatErrorForJson({
        message: 'miss',
        code: 'CACHE_MISS',
        suggestions: ['fetch it'],
        ref: 'https://example.com/docs',
      })
    ).toBe('miss\nCode: CACHE_MISS\nTry this: fetch it\nReference: https://example.com/docs');

    expect(
      formatErrorForJson({
        message: 'miss',
        code: 'CACHE_MISS',
        suggestions: ['a', 'b'],
      })
    ).toBe('miss\nCode: CACHE_MISS\nTry this:\n* a\n* b');
  });
});

describe('buildEnvelope', () => {
  it('builds the success envelope shape', () => {
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

describe('enrichCacheMissEnvelope / enrichRowErrorEnvelope', () => {
  it('passes through when there are no failures', () => {
    const base = { ok: true, exitCode: 0, data: { status: 'hit' } };
    expect(enrichCacheMissEnvelope(base, base.data, 'bonsai')).toBe(base);
  });

  it('marks CACHE_MISS and keeps data when any row misses', () => {
    const data = [
      { status: 'hit', normalizedUrl: 'https://a.example/' },
      { status: 'miss', normalizedUrl: 'https://b.example/' },
    ];
    const enriched = enrichCacheMissEnvelope({ ok: true, exitCode: 0, data }, data, 'bonsai');
    expect(enriched).toMatchObject({
      ok: false,
      exitCode: 1,
      code: 'CACHE_MISS',
      suggestions: ['Fetch and cache it first: bonsai https://b.example/'],
    });
    expect(enriched.stderr).toContain('Cache miss for https://b.example/');
    expect(enriched.data).toBe(data);
  });

  it('points a CACHE_MISS at list --url instead of a duplicate fetch when part of an existing note', () => {
    const data = [
      {
        status: 'miss',
        normalizedUrl: 'https://b.example/doc',
        partOfExistingNote: { cacheKey: 'abc123' },
      },
    ];
    const enriched = enrichCacheMissEnvelope({ ok: true, exitCode: 0, data }, data, 'bonsai');
    expect(enriched).toMatchObject({
      ok: false,
      exitCode: 1,
      code: 'CACHE_MISS',
      suggestions: ['Find it with: bonsai list --url "https://b.example/doc"'],
    });
    expect(String(enriched.stderr)).not.toContain('Fetch and cache it first');
  });

  it('supports row-error overlays from per-row error objects', () => {
    const data = [
      { cache: { status: 'hit' } },
      { error: { code: 'FETCH_FAILED', message: 'dns', suggestions: ['retry'] } },
    ];
    const enriched = enrichRowErrorEnvelope({ ok: true, exitCode: 0, data }, data);
    expect(enriched).toMatchObject({
      ok: false,
      exitCode: 1,
      code: 'FETCH_FAILED',
      suggestions: ['retry'],
    });
    expect(enriched.stderr).toContain('dns');
    expect(enriched.data).toBe(data);
  });
});
