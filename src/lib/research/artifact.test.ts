import { describe, it, expect } from 'vitest';
import {
  serializeArtifact,
  parseArtifact,
  parseArtifactShallow,
  parseMetadata,
  extractSection,
} from './artifact.js';
import type { ResearchArtifact } from './schema.js';

describe('artifact serialization and parsing', () => {
  const sampleArtifact: ResearchArtifact = {
    metadata: {
      schema_version: 1,
      artifact_type: 'source',
      source_url: 'https://example.com/docs',
      source_urls: ['https://example.com/docs'],
      normalized_url: 'https://example.com/docs',
      cache_key: 'sha256-somekey',
      topic: 'React docs',
      tags: ['react'],
      format_available: ['compressed', 'detailed'],
      tier: 'standard',
      ttl: null,
      fetched_at: '2026-06-24T00:00:00.000Z',
      validated_at: '2026-06-24T00:00:00.000Z',
      stale_after: '2026-07-24T00:00:00.000Z',
      capture_method: 'static_fetch',
      extraction_status: 'extracted',
      extraction_confidence: 'high',
      quality_notes: ['readability extracted main article'],
      supplied_at: null,
      supplied_by: null,
      etag: null,
      last_modified: null,
      content_hash: 'sha256-contenthash',
      token_estimate: { compressed: 123, detailed: 456 },
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
    summary: 'This is the summary.',
    compressed: 'This is compressed content.',
    detailed: 'This is detailed content with **bold** markup.',
    provenance: 'Fetched from example.com',
  };

  it('serializes and parses back to an equivalent artifact', () => {
    const serialized = serializeArtifact(sampleArtifact);
    expect(serialized).toContain('schema_version: 1');
    expect(serialized).toContain('## Summary\n\nThis is the summary.');

    const parsed = parseArtifact(serialized);
    expect(parsed).toEqual(sampleArtifact);
  });

  it('throws on missing boundaries', () => {
    expect(() => parseArtifact('malformed')).toThrow(/Frontmatter missing starting boundary/);
    expect(() => parseArtifact('---\nsome: field')).toThrow(/Frontmatter missing ending boundary/);
  });

  it('roundtrips site_module_id correctly', () => {
    const withModule = {
      ...sampleArtifact,
      metadata: { ...sampleArtifact.metadata, site_module_id: 'react' },
    };
    const parsed = parseArtifact(serializeArtifact(withModule));
    expect(parsed.metadata.site_module_id).toBe('react');
  });

  it('roundtrips populated Phase 2 metadata fields (colons, ">" in values)', () => {
    const withPhase2 = {
      ...sampleArtifact,
      metadata: {
        ...sampleArtifact.metadata,
        artifact_type: 'section' as const,
        docs_engine: 'vitepress',
        source_doc_url: 'https://raw.githubusercontent.com/vuejs/docs/main/src/guide/intro.md',
        search_provider: 'vitepress-local',
        parent_cache_key: 'abc123',
        section_anchor: 'class-url',
        section_heading_path: 'URL > The WHATWG URL API > Class: URL',
      },
    };
    expect(parseArtifact(serializeArtifact(withPhase2))).toEqual(withPhase2);
  });

  it('parses legacy frontmatter without site_module_id as null', () => {
    const serialized = serializeArtifact(sampleArtifact);
    const stripped = serialized.replace(/\nsite_module_id:.*/, '');
    const parsed = parseArtifact(stripped);
    expect(parsed.metadata.site_module_id).toBeNull();
  });

  it('parses a non-numeric token_estimate value as null', () => {
    // A nested key under token_estimate whose value is not a number becomes null.
    const meta = parseMetadata(['token_estimate:', '  compressed: abc', '  detailed: 42']);
    expect(meta.token_estimate.compressed).toBeNull();
    expect(meta.token_estimate.detailed).toBe(42);
  });

  it('ignores stray indented array items and lines without a colon', () => {
    // A "  - x" item with no active array key is dropped silently; a root line without a colon
    // is skipped; blank lines are skipped. None of these should corrupt the defaults.
    const meta = parseMetadata(['  - orphan', 'no-colon-line', '', 'topic: Real Topic']);
    expect(meta.topic).toBe('Real Topic');
    expect(meta.tags).toEqual([]);
  });

  it('extractSection returns empty string for a missing section', () => {
    expect(extractSection('## Summary\n\ntext', 'Provenance')).toBe('');
  });

  describe('parseArtifactShallow', () => {
    it('parses metadata/summary/compressed but skips the detailed and provenance bodies', () => {
      const parsed = parseArtifactShallow(serializeArtifact(sampleArtifact));
      expect(parsed.metadata).toEqual(sampleArtifact.metadata);
      expect(parsed.summary).toBe(sampleArtifact.summary);
      expect(parsed.compressed).toBe(sampleArtifact.compressed);
      expect(parsed.detailed).toBe('');
      expect(parsed.provenance).toBe('');
    });

    it('matches parseArtifact on summary/compressed even when the body contains a "## Detailed" line', () => {
      // Content that includes a "## Detailed" heading collides with the section delimiter — but that
      // is an inherent property of the format that parseArtifact shares. The contract is parity: the
      // shallow parser must never return different summary/compressed than the full parser.
      const tricky: ResearchArtifact = {
        ...sampleArtifact,
        compressed: 'Formats include:\n\n## Detailed\nthat heading is part of the prose here.',
      };
      const serialized = serializeArtifact(tricky);
      const shallow = parseArtifactShallow(serialized);
      const full = parseArtifact(serialized);
      expect(shallow.summary).toBe(full.summary);
      expect(shallow.compressed).toBe(full.compressed);
    });

    it('is not fooled by the marker appearing inside a frontmatter value', () => {
      // The frontmatter is searched past before looking for the Detailed boundary, so a marker-like
      // value can't truncate the body.
      const withMarkerInMeta: ResearchArtifact = {
        ...sampleArtifact,
        metadata: { ...sampleArtifact.metadata, topic: 'about\n## Detailed sections' },
      };
      const serialized = serializeArtifact(withMarkerInMeta);
      const shallow = parseArtifactShallow(serialized);
      const full = parseArtifact(serialized);
      expect(shallow.summary).toBe(full.summary);
      expect(shallow.compressed).toBe(full.compressed);
    });

    it('returns the full body when there is no Detailed section', () => {
      const noDetailed = `---\nschema_version: 1\ncache_key: abc\n---\n\n## Summary\n\nonly a summary`;
      const parsed = parseArtifactShallow(noDetailed);
      expect(parsed.summary).toBe('only a summary');
      expect(parsed.detailed).toBe('');
    });
  });
});
