import { describe, it, expect } from 'vitest';
import { pruneFlagError } from './prune-flags.js';

const base = {
  dryRun: false,
  yes: false,
  readOnly: false,
  bin: 'bonsai',
};

describe('pruneFlagError', () => {
  it('rejects an empty --url', () => {
    expect(pruneFlagError({ ...base, url: '', dryRun: true })?.code).toBe('INVALID_FLAG_VALUE');
  });

  it('requires at least one filter', () => {
    expect(pruneFlagError(base)?.code).toBe('MISSING_FILTER');
  });

  it('prefers READ_ONLY_MODE over CONFLICTING_FLAGS when both apply', () => {
    expect(
      pruneFlagError({ ...base, olderThan: '1d', dryRun: true, yes: true, readOnly: true })?.code
    ).toBe('READ_ONLY_MODE');
  });

  it('rejects --dry-run with --yes', () => {
    expect(pruneFlagError({ ...base, olderThan: '1d', dryRun: true, yes: true })?.code).toBe(
      'CONFLICTING_FLAGS'
    );
  });

  it('requires --yes or --dry-run when not read-only', () => {
    expect(pruneFlagError({ ...base, olderThan: '1d' })?.code).toBe('SAFETY_CHECK_REQUIRED');
  });

  it('surfaces duration parse errors', () => {
    expect(pruneFlagError({ ...base, olderThan: '5z', dryRun: true })?.code).toBe(
      'INVALID_DURATION'
    );
  });

  it('rejects empty --older-than as INVALID_DURATION not MISSING_FILTER', () => {
    expect(pruneFlagError({ ...base, olderThan: '', dryRun: true })?.code).toBe('INVALID_DURATION');
  });

  it('accepts a valid dry-run', () => {
    expect(pruneFlagError({ ...base, olderThan: '30d', dryRun: true })).toBeNull();
  });

  it('accepts --topic alone as a sufficient filter', () => {
    expect(pruneFlagError({ ...base, topic: 'React', dryRun: true })).toBeNull();
  });

  it('accepts --tags alone as a sufficient filter', () => {
    expect(pruneFlagError({ ...base, tags: ['deprecated'], dryRun: true })).toBeNull();
  });

  it('rejects an empty --topic', () => {
    expect(pruneFlagError({ ...base, topic: '  ', dryRun: true })?.code).toBe('INVALID_FLAG_VALUE');
  });

  it('rejects an empty --tags entry', () => {
    expect(pruneFlagError({ ...base, tags: ['react', ''], dryRun: true })?.code).toBe(
      'INVALID_FLAG_VALUE'
    );
  });

  it('still requires at least one filter when --tags is passed as an empty array', () => {
    expect(pruneFlagError({ ...base, tags: [] })?.code).toBe('MISSING_FILTER');
  });
});
