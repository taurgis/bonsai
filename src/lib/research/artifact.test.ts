import { describe, it, expect } from 'vitest';
import { serializeArtifact, parseArtifact } from './artifact.js';
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
});
