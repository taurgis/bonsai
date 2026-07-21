import { describe, it, expect } from 'vitest';
import {
  matchesTopicFilter,
  matchesTagsFilter,
  emptyTopicFilterError,
  emptyTagsFilterError,
} from './metadata-filters.js';

describe('matchesTopicFilter', () => {
  it('matches case-insensitively, trimming both sides', () => {
    expect(matchesTopicFilter({ topic: 'React Suspense' }, 'react suspense')).toBe(true);
    expect(matchesTopicFilter({ topic: 'React Suspense' }, '  React Suspense  ')).toBe(true);
  });

  it('rejects a different topic', () => {
    expect(matchesTopicFilter({ topic: 'React Suspense' }, 'Vue')).toBe(false);
  });

  it('rejects a null topic when a filter is given', () => {
    expect(matchesTopicFilter({ topic: null }, 'React Suspense')).toBe(false);
  });

  it('treats an undefined filter as "match everything"', () => {
    expect(matchesTopicFilter({ topic: null }, undefined)).toBe(true);
    expect(matchesTopicFilter({ topic: 'Anything' }, undefined)).toBe(true);
  });
});

describe('matchesTagsFilter', () => {
  it('requires every filter tag to be present, case-insensitively', () => {
    expect(matchesTagsFilter({ tags: ['React', 'Suspense'] }, ['react'])).toBe(true);
    expect(matchesTagsFilter({ tags: ['React', 'Suspense'] }, ['react', 'suspense'])).toBe(true);
    expect(matchesTagsFilter({ tags: ['React'] }, ['react', 'suspense'])).toBe(false);
  });

  it('treats an undefined or empty filter as "match everything"', () => {
    expect(matchesTagsFilter({ tags: [] }, undefined)).toBe(true);
    expect(matchesTagsFilter({ tags: [] }, [])).toBe(true);
  });
});

describe('emptyTopicFilterError', () => {
  it('is undefined when the flag was not passed', () => {
    expect(emptyTopicFilterError(undefined)).toBeUndefined();
  });

  it('flags a whitespace-only topic as a likely shell-quoting mistake', () => {
    expect(emptyTopicFilterError('')).toMatch(/non-empty/);
    expect(emptyTopicFilterError('   ')).toMatch(/non-empty/);
  });

  it('accepts a real topic', () => {
    expect(emptyTopicFilterError('React Suspense')).toBeUndefined();
  });
});

describe('emptyTagsFilterError', () => {
  it('is undefined when the flag was not passed', () => {
    expect(emptyTagsFilterError(undefined)).toBeUndefined();
  });

  it('flags any whitespace-only tag entry', () => {
    expect(emptyTagsFilterError([''])).toMatch(/non-empty/);
    expect(emptyTagsFilterError(['react', '  '])).toMatch(/non-empty/);
  });

  it('accepts a list of real tags', () => {
    expect(emptyTagsFilterError(['react', 'suspense'])).toBeUndefined();
  });
});
