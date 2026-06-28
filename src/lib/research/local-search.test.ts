import { describe, it, expect } from 'vitest';
import {
  buildSearchCorpusStats,
  isEmptySearchQuery,
  makeSearchSnippet,
  parseSearchQuery,
  phraseInTokenSequence,
  prepareSearchArtifact,
  scoreLocalSearch,
} from './local-search.js';
import type { ResearchArtifact } from './schema.js';

function makeArtifact(
  overrides: Partial<ResearchArtifact> & { metadata?: Partial<ResearchArtifact['metadata']> } = {}
): ResearchArtifact {
  return {
    metadata: {
      schema_version: 1,
      artifact_type: 'source',
      source_url: 'https://example.com/docs',
      source_urls: ['https://example.com/docs'],
      normalized_url: 'https://example.com/docs',
      cache_key: 'key1',
      topic: 'React Hooks',
      tags: ['react', 'hooks'],
      format_available: ['compressed', 'detailed'],
      tier: 'standard',
      ttl: null,
      fetched_at: null,
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
      content_hash: 'hash',
      token_estimate: { compressed: 10, detailed: 20 },
      status: 'active',
      site_module_id: null,
      docs_engine: null,
      docs_framework: null,
      source_doc_url: null,
      search_provider: null,
      parent_cache_key: null,
      section_anchor: null,
      section_heading_path: null,
      ...overrides.metadata,
    },
    summary: overrides.summary ?? 'Guide to React useEffect cleanup patterns.',
    compressed: overrides.compressed ?? 'React useEffect cleanup runs before unmount.',
    detailed: overrides.detailed ?? '',
    provenance: overrides.provenance ?? '',
  };
}

function prep(artifact: ResearchArtifact) {
  return prepareSearchArtifact(artifact);
}

describe('parseSearchQuery', () => {
  it('extracts quoted phrases and strips stopwords from unquoted terms', () => {
    const parsed = parseSearchQuery('how to find "use effect" in react');
    expect(parsed.phrases).toEqual(['use effect']);
    expect(parsed.terms).toEqual(['find', 'react']);
    expect(isEmptySearchQuery(parsed)).toBe(false);
  });

  it('treats all-stopword unquoted input as empty when no phrases', () => {
    const parsed = parseSearchQuery('the and or');
    expect(isEmptySearchQuery(parsed)).toBe(true);
  });

  it('keeps phrase-only queries', () => {
    const parsed = parseSearchQuery('"nestjs config"');
    expect(parsed.terms).toEqual([]);
    expect(parsed.phrases).toEqual(['nestjs config']);
  });
});

describe('phraseInTokenSequence', () => {
  it('matches consecutive tokens but not embedded substrings', () => {
    expect(phraseInTokenSequence('use effect', 'React use effect cleanup')).toBe(true);
    expect(phraseInTokenSequence('art', 'Start the cart flow')).toBe(false);
    expect(phraseInTokenSequence('use effect', 'use hooks and side effect cleanup')).toBe(false);
  });
});

describe('scoreLocalSearch AND semantics', () => {
  const corpus = buildSearchCorpusStats([
    prep(makeArtifact()),
    prep(
      makeArtifact({
        metadata: { cache_key: 'key2', topic: 'Vue Components', tags: ['vue'] },
        summary: 'Vue component lifecycle overview.',
        compressed: 'Vue mount and unmount hooks.',
      })
    ),
  ]);

  it('requires every term to match', () => {
    const query = parseSearchQuery('react vue');
    expect(scoreLocalSearch(prep(makeArtifact()), query, corpus, 'fresh')).toBeNull();
  });

  it('matches when all terms hit the same artifact', () => {
    const query = parseSearchQuery('react useeffect');
    const result = scoreLocalSearch(prep(makeArtifact()), query, corpus, 'fresh');
    expect(result).not.toBeNull();
    expect(result!.matchedTerms.some((m) => m.term === 'react')).toBe(true);
    expect(result!.matchedTerms.some((m) => m.term === 'useeffect')).toBe(true);
  });

  it('requires quoted phrases to appear as consecutive tokens', () => {
    const artifact = prep(
      makeArtifact({
        summary: 'React use effect cleanup runs on unmount.',
        compressed: '',
      })
    );
    const query = parseSearchQuery('"use effect"');
    const hit = scoreLocalSearch(artifact, query, corpus, 'fresh');
    expect(hit).not.toBeNull();
    expect(hit!.matchedTerms[0]?.kind).toBe('phrase');

    const miss = scoreLocalSearch(
      prep(makeArtifact({ summary: 'use hooks and side effect cleanup', compressed: '' })),
      query,
      corpus,
      'fresh'
    );
    expect(miss).toBeNull();
  });

  it('does not match substrings inside unrelated words', () => {
    const query = parseSearchQuery('art');
    const result = scoreLocalSearch(
      prep(makeArtifact({ summary: 'Start the cart flow', compressed: 'restart required' })),
      query,
      corpus,
      'fresh'
    );
    expect(result).toBeNull();
  });

  it('rejects quoted phrases that only match inside another token', () => {
    const query = parseSearchQuery('"art"');
    const result = scoreLocalSearch(
      prep(makeArtifact({ summary: 'Start the cart flow', compressed: '' })),
      query,
      corpus,
      'fresh'
    );
    expect(result).toBeNull();
  });

  it('ranks exact topic phrase matches above scattered terms', () => {
    const exact = prep(
      makeArtifact({
        metadata: { cache_key: 'exact', topic: 'Custom NestJS Config' },
        summary: 'Custom NestJS Config details.',
        compressed: '',
      })
    );
    const scattered = prep(
      makeArtifact({
        metadata: { cache_key: 'scattered', topic: 'NestJS Guide Config' },
        summary: 'NestJS guide with config notes.',
        compressed: '',
      })
    );
    const localCorpus = buildSearchCorpusStats([exact, scattered]);
    const query = parseSearchQuery('nestjs config');

    const exactScore = scoreLocalSearch(exact, query, localCorpus, 'fresh')!.score;
    const scatteredScore = scoreLocalSearch(scattered, query, localCorpus, 'fresh')!.score;
    expect(exactScore).toBeGreaterThan(scatteredScore);
  });

  it('supports prefix matching for partial tokens', () => {
    const query = parseSearchQuery('authent');
    const result = scoreLocalSearch(
      prep(makeArtifact({ summary: 'OAuth authentication flow for agents.', compressed: '' })),
      query,
      buildSearchCorpusStats([prep(makeArtifact())]),
      'fresh'
    );
    expect(result?.matchedTerms[0]?.kind).toBe('prefix');
  });

  it('supports prefix and fuzzy matching on tags', () => {
    const query = parseSearchQuery('nestj');
    const result = scoreLocalSearch(
      prep(
        makeArtifact({
          metadata: { topic: 'NestJS Framework', tags: ['nestjs'] },
          summary: 'Framework guide.',
          compressed: '',
        })
      ),
      query,
      buildSearchCorpusStats([prep(makeArtifact())]),
      'fresh'
    );
    expect(result).not.toBeNull();
    expect(['prefix', 'fuzzy']).toContain(result!.matchedTerms[0]?.kind);
  });

  it('applies section boost inside scoreLocalSearch', () => {
    const query = parseSearchQuery('react');
    const source = prep(makeArtifact());
    const section = prep(
      makeArtifact({ metadata: { cache_key: 'section', artifact_type: 'section' } })
    );
    const corpusOne = buildSearchCorpusStats([source]);
    const sourceScore = scoreLocalSearch(source, query, corpusOne, 'fresh')!.score;
    const sectionScore = scoreLocalSearch(section, query, corpusOne, 'fresh')!.score;
    expect(sectionScore - sourceScore).toBe(15);
  });
});

describe('makeSearchSnippet', () => {
  it('prefers summary and centers on the best term coverage window', () => {
    const query = parseSearchQuery('useeffect cleanup');
    const snippet = makeSearchSnippet(
      makeArtifact({
        summary: 'Intro paragraph. React useEffect cleanup runs on unmount. More text here.',
        compressed: 'compressed fallback',
      }),
      query
    );
    expect(snippet.toLowerCase()).toContain('useeffect');
    expect(snippet.toLowerCase()).toContain('cleanup');
  });
});
