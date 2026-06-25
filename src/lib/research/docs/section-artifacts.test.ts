import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ResearchArtifact } from '../schema.js';
import { buildSectionArtifacts, persistSectionArtifacts } from './section-artifacts.js';
import { scanCacheDir, findArtifact } from '../storage.js';

// A long multi-section page that comfortably exceeds the section token threshold.
function longDoc(sections: string[]): string {
  const body = sections
    .map((title) => `## ${title}\n\n${`Detailed reference prose for ${title}. `.repeat(400)}`)
    .join('\n\n');
  return `# Reference\n\nIntro.\n\n${body}`;
}

function makeParent(detailed: string): ResearchArtifact {
  return {
    metadata: {
      schema_version: 1,
      artifact_type: 'source',
      source_url: 'https://nodejs.org/api/url.html',
      source_urls: ['https://nodejs.org/api/url.html'],
      normalized_url: 'https://nodejs.org/api/url.html',
      cache_key: 'abc123',
      topic: null,
      tags: [],
      format_available: ['compressed', 'detailed'],
      tier: 'standard',
      ttl: null,
      fetched_at: '2026-06-24T00:00:00.000Z',
      validated_at: '2026-06-24T00:00:00.000Z',
      stale_after: '2026-07-24T00:00:00.000Z',
      capture_method: 'static_fetch',
      extraction_status: 'extracted',
      extraction_confidence: 'high',
      quality_notes: [],
      supplied_at: null,
      supplied_by: null,
      etag: null,
      last_modified: null,
      content_hash: 'sha256-x',
      token_estimate: { compressed: 1, detailed: 1 },
      status: 'active',
      site_module_id: null,
      docs_engine: 'generated-static',
      docs_framework: null,
      source_doc_url: null,
      search_provider: null,
      parent_cache_key: null,
      section_anchor: null,
      section_heading_path: null,
    },
    summary: 'Reference',
    compressed: 'c',
    detailed,
    provenance: 'p',
  };
}

describe('buildSectionArtifacts (T-22)', () => {
  it('returns [] for a short page', () => {
    expect(
      buildSectionArtifacts(makeParent('# Short\n\ntiny'), new Date(), 'conservative')
    ).toHaveLength(0);
  });

  it('builds hex-keyed section children linked to the parent', () => {
    const parent = makeParent(longDoc(['Alpha', 'Beta', 'Gamma']));
    const children = buildSectionArtifacts(parent, new Date(), 'conservative');
    expect(children.length).toBe(3);
    for (const child of children) {
      expect(child.metadata.artifact_type).toBe('section');
      expect(child.metadata.parent_cache_key).toBe('abc123');
      expect(child.metadata.cache_key).toMatch(/^[a-f0-9]{64}$/);
      expect(child.metadata.source_url).toContain('#');
    }
    expect(children.map((c) => c.metadata.section_anchor)).toEqual(['alpha', 'beta', 'gamma']);
  });
});

describe('persistSectionArtifacts (T-22)', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'fnr-sections-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes children and archives orphaned sections on regeneration', () => {
    const first = makeParent(longDoc(['Alpha', 'Beta', 'Gamma']));
    expect(persistSectionArtifacts(dir, first, new Date(), 'conservative')).toBe(3);

    // Regenerate with Gamma removed -> its child must be archived, not left active.
    const second = makeParent(longDoc(['Alpha', 'Beta']));
    expect(persistSectionArtifacts(dir, second, new Date(), 'conservative')).toBe(2);

    const active = scanCacheDir(join(dir, 'research'), (a) =>
      a.metadata.artifact_type === 'section' && a.metadata.status === 'active'
        ? a.metadata.section_anchor
        : null
    );
    expect(active.sort()).toEqual(['alpha', 'beta']);

    const archived = scanCacheDir(join(dir, 'research'), (a) =>
      a.metadata.status === 'archived' ? a.metadata.section_anchor : null
    );
    expect(archived).toContain('gamma');
  });

  it('makes child sections findable by their own cache key', () => {
    const parent = makeParent(longDoc(['Alpha', 'Beta']));
    const children = buildSectionArtifacts(parent, new Date(), 'conservative');
    persistSectionArtifacts(dir, parent, new Date(), 'conservative');
    const found = findArtifact(dir, children[0]!.metadata.cache_key);
    expect(found?.metadata.artifact_type).toBe('section');
  });
});
