import { describe, it, expect } from 'vitest';
import { extractKeywords, applyAutoTags, dedupeTags } from './keywords.js';
import type { ResearchArtifact } from './schema.js';

function artifactWith(tags: string[], detailed: string): ResearchArtifact {
  return {
    metadata: {
      schema_version: 1,
      artifact_type: 'source',
      source_url: '',
      source_urls: [],
      normalized_url: '',
      cache_key: 'abc',
      topic: null,
      tags,
      format_available: [],
      tier: 'standard',
      ttl: null,
      fetched_at: null,
      validated_at: null,
      stale_after: null,
      capture_method: null,
      extraction_status: null,
      extraction_confidence: null,
      quality_notes: ['existing note'],
      supplied_at: null,
      supplied_by: null,
      etag: null,
      last_modified: null,
      content_hash: '',
      token_estimate: { compressed: null, detailed: null },
      status: 'active',
      site_module_id: null,
      docs_engine: null,
      docs_framework: null,
      source_doc_url: null,
      search_provider: null,
      parent_cache_key: null,
      section_anchor: null,
      section_heading_path: null,
    },
    summary: '',
    compressed: '',
    detailed,
    provenance: '',
  };
}

describe('extractKeywords', () => {
  it('ranks the most frequent meaningful terms first', () => {
    const text = 'Webhooks deliver events. Webhooks retry on failure. Webhooks are signed events.';
    const tags = extractKeywords(text, 3);
    expect(tags[0]).toBe('webhooks');
    expect(tags).toContain('events');
  });

  it('drops stopwords, pure numbers, and very short tokens', () => {
    const tags = extractKeywords('the the the it 42 99 io go to be or not', 5);
    expect(tags).not.toContain('the');
    expect(tags).not.toContain('42');
    expect(tags).not.toContain('it');
    expect(tags).not.toContain('or');
  });

  it('boosts terms that appear in Markdown headings', () => {
    // "caching" appears once in a heading; "request" appears twice in the body. The heading boost
    // (+3) should lift the single heading mention above the more frequent body term.
    const text = '# Caching\nYou send a request and another request to the server.';
    const tags = extractKeywords(text, 1);
    expect(tags).toEqual(['caching']);
  });

  it('ignores code fences, inline code, and URLs', () => {
    const text =
      'Routing matters here. Routing again.\n```\nconst secret = "topsecret topsecret";\n```\n' +
      '`inlinecode` see https://example.com/topsecret-page for routing details.';
    const tags = extractKeywords(text, 5);
    expect(tags).toContain('routing');
    expect(tags).not.toContain('topsecret');
    expect(tags).not.toContain('inlinecode');
  });

  it('is deterministic for ties (alphabetical) and respects the max', () => {
    const text = 'alpha beta gamma delta'; // all frequency 1
    expect(extractKeywords(text, 2)).toEqual(['alpha', 'beta']);
  });

  it('returns an empty array for empty or content-free input', () => {
    expect(extractKeywords('', 5)).toEqual([]);
    expect(extractKeywords('   ', 5)).toEqual([]);
    expect(extractKeywords('the a an it', 5)).toEqual([]);
    expect(extractKeywords('hello world', 0)).toEqual([]);
  });
});

describe('dedupeTags', () => {
  it('drops case-insensitive duplicates and blanks, preserving first-seen order and casing', () => {
    expect(dedupeTags(['Node', 'node', 'NODE', 'react'])).toEqual(['Node', 'react']);
    expect(dedupeTags([' spaced ', 'spaced'])).toEqual(['spaced']);
    expect(dedupeTags(['', '   ', 'a'])).toEqual(['a']);
    expect(dedupeTags([])).toEqual([]);
  });
});

describe('applyAutoTags', () => {
  it('derives tags from detailed content and appends a quality note when tags are empty', () => {
    const artifact = artifactWith(
      [],
      'Webhooks deliver events. Webhooks retry. Webhooks sign events.'
    );
    applyAutoTags(artifact);
    expect(artifact.metadata.tags).toContain('webhooks');
    expect(artifact.metadata.quality_notes).toEqual([
      'existing note',
      'auto-generated tags via keyword extraction',
    ]);
  });

  it('leaves caller-supplied tags untouched and adds no note', () => {
    const artifact = artifactWith(['manual'], 'Webhooks deliver events repeatedly here.');
    applyAutoTags(artifact);
    expect(artifact.metadata.tags).toEqual(['manual']);
    expect(artifact.metadata.quality_notes).toEqual(['existing note']);
  });

  it('dedupes and trims caller-supplied tags without adding a note', () => {
    const artifact = artifactWith(
      ['node', 'node', 'Node', ' spaced ', ''],
      'Webhooks deliver events repeatedly here.'
    );
    applyAutoTags(artifact);
    expect(artifact.metadata.tags).toEqual(['node', 'spaced']);
    expect(artifact.metadata.quality_notes).toEqual(['existing note']);
  });

  it('falls through to auto-tagging when caller-supplied tags are all blank', () => {
    const artifact = artifactWith(
      ['', '   '],
      'Webhooks deliver events. Webhooks retry. Webhooks sign events.'
    );
    applyAutoTags(artifact);
    expect(artifact.metadata.tags).toContain('webhooks');
    expect(artifact.metadata.quality_notes).toEqual([
      'existing note',
      'auto-generated tags via keyword extraction',
    ]);
  });

  it('does not add a note when content yields no keywords', () => {
    const artifact = artifactWith([], 'the a an it to of');
    applyAutoTags(artifact);
    expect(artifact.metadata.tags).toEqual([]);
    expect(artifact.metadata.quality_notes).toEqual(['existing note']);
  });
});
