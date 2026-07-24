import { describe, it, expect } from 'vitest';
import {
  matchesTopicFilter,
  matchesTagsFilter,
  matchesCommonMetadataFilters,
  emptyTopicFilterError,
  emptyTagsFilterError,
} from './metadata-filters.js';
import type { ResearchArtifactMetadata } from './schema.js';

const now = new Date().toISOString();

/** Minimal metadata fixture; overrides fill in only the fields a test cares about. */
function makeMeta(overrides: Partial<ResearchArtifactMetadata> = {}): ResearchArtifactMetadata {
  return {
    schema_version: 1,
    artifact_type: 'source',
    source_url: 'https://example.com/page',
    source_urls: ['https://example.com/page'],
    normalized_url: 'https://example.com/page',
    cache_key: 'a'.repeat(64),
    topic: 'React Suspense',
    tags: ['react', 'suspense'],
    format_available: ['compressed', 'detailed'],
    tier: 'standard',
    ttl: null,
    fetched_at: now,
    validated_at: now,
    stale_after: null,
    capture_method: 'static_fetch',
    extraction_status: 'extracted',
    extraction_confidence: 'high',
    quality_notes: [],
    supplied_at: null,
    supplied_by: null,
    etag: null,
    last_modified: null,
    content_hash: 'hash',
    token_estimate: { compressed: 1, detailed: 1 },
    status: 'active',
    site_module_id: null,
    docs_engine: null,
    docs_framework: null,
    source_doc_url: null,
    search_provider: null,
    parent_cache_key: null,
    section_anchor: null,
    section_heading_path: null,
    ...overrides,
  };
}

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

describe('matchesCommonMetadataFilters', () => {
  it('matches everything when no filter flags are set', () => {
    expect(matchesCommonMetadataFilters(makeMeta(), 'fresh', {})).toBe(true);
  });

  it('rejects on a non-matching --topic, independent of other filters', () => {
    expect(matchesCommonMetadataFilters(makeMeta(), 'fresh', { topic: 'Vue' })).toBe(false);
  });

  it('rejects on a non-matching --tags', () => {
    expect(matchesCommonMetadataFilters(makeMeta(), 'fresh', { tags: ['nonexistent-tag'] })).toBe(
      false
    );
  });

  it('rejects on a non-matching --url glob', () => {
    expect(
      matchesCommonMetadataFilters(makeMeta(), 'fresh', { url: 'https://other.example/*' })
    ).toBe(false);
  });

  it('accepts a matching --url glob', () => {
    expect(
      matchesCommonMetadataFilters(makeMeta(), 'fresh', { url: 'https://example.com/*' })
    ).toBe(true);
  });

  it('rejects on a non-matching --artifact-type', () => {
    expect(
      matchesCommonMetadataFilters(makeMeta({ artifact_type: 'source' }), 'fresh', {
        artifactType: 'research_note',
      })
    ).toBe(false);
  });

  it('rejects on a non-matching --capture-method', () => {
    expect(
      matchesCommonMetadataFilters(makeMeta({ capture_method: 'static_fetch' }), 'fresh', {
        captureMethod: 'browser_fallback',
      })
    ).toBe(false);
  });

  it('rejects on a non-matching --freshness', () => {
    expect(matchesCommonMetadataFilters(makeMeta(), 'stale_expired', { freshness: 'fresh' })).toBe(
      false
    );
  });

  it('accepts when every given filter matches, combined', () => {
    expect(
      matchesCommonMetadataFilters(makeMeta(), 'fresh', {
        topic: 'react suspense',
        tags: ['react'],
        url: 'https://example.com/*',
        artifactType: 'source',
        captureMethod: 'static_fetch',
        freshness: 'fresh',
      })
    ).toBe(true);
  });

  it('rejects when every filter matches except one (AND semantics across filter kinds)', () => {
    expect(
      matchesCommonMetadataFilters(makeMeta(), 'fresh', {
        topic: 'react suspense',
        tags: ['react'],
        artifactType: 'source',
        captureMethod: 'static_fetch',
        freshness: 'stale_grace', // the one mismatch
      })
    ).toBe(false);
  });
});
