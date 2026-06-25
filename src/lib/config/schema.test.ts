import { describe, it, expect } from 'vitest';
import {
  isKnownKey,
  suggestKey,
  validKeysHint,
  KEY_META,
  ALL_KEYS,
  BUILT_IN_DEFAULTS,
} from './schema.js';

describe('schema key guards', () => {
  it('recognises known keys and rejects unknown ones', () => {
    expect(isKnownKey('storage')).toBe(true);
    expect(isKnownKey('nope')).toBe(false);
  });

  it('suggests the nearest key for a fuzzy input', () => {
    expect(suggestKey('stor')).toBe('storage');
    expect(suggestKey('STORAGE')).toBe('storage');
    expect(suggestKey('zzz')).toBeUndefined();
  });

  it('lists valid keys for error messages', () => {
    expect(validKeysHint()).toBe('storage, summary');
    expect(ALL_KEYS).toContain('storage');
    expect(ALL_KEYS).toContain('summary');
    expect(BUILT_IN_DEFAULTS.storage).toBe('global');
    expect(BUILT_IN_DEFAULTS.summary).toBe('conservative');
  });

  it('recognises the summary key and suggests it for a fuzzy input', () => {
    expect(isKnownKey('summary')).toBe(true);
    expect(suggestKey('summ')).toBe('summary');
  });
});

describe('KEY_META.storage', () => {
  const meta = KEY_META.storage;
  it('parses, validates, and formats values', () => {
    expect(meta.parseValue('  project ')).toBe('project');
    expect(meta.isValid('project')).toBe(true);
    expect(meta.isValid('global')).toBe(true);
    expect(meta.isValid('bogus')).toBe(false);
    expect(meta.format('project')).toBe('project');
    expect(meta.values).toEqual(['global', 'project']);
  });
});

describe('KEY_META.summary', () => {
  const meta = KEY_META.summary;
  it('parses, validates, and formats values', () => {
    expect(meta.parseValue('  balanced ')).toBe('balanced');
    expect(meta.isValid('conservative')).toBe(true);
    expect(meta.isValid('balanced')).toBe(true);
    expect(meta.isValid('aggressive')).toBe(true);
    expect(meta.isValid('bogus')).toBe(false);
    expect(meta.format('aggressive')).toBe('aggressive');
    expect(meta.values).toEqual(['conservative', 'balanced', 'aggressive']);
  });
});
