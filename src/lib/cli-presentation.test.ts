import { describe, expect, it } from 'vitest';
import {
  CLI_FLAG_DESCRIPTION_FRAGMENTS,
  CLI_FLAG_DESCRIPTIONS,
  formatHumanField,
  formatHumanFields,
} from './cli-presentation.js';

describe('CLI presentation helpers', () => {
  it('defines reusable flag description fragments once', () => {
    expect(CLI_FLAG_DESCRIPTION_FRAGMENTS).toMatchObject({
      freshnessTierPolicy: 'freshness tier policy',
      topic: 'topic',
      ttlExample: 'e.g. "2h", "7d"',
      importTtlExample: 'e.g. "24h", "7d"',
      storageSecretScope: 'secrets always stored globally',
      taxonomicTags: 'taxonomic tags',
      filterTags: 'tags',
      repeatable: 'can be repeated',
    });
  });

  it('keeps shared flag descriptions centralized', () => {
    expect(CLI_FLAG_DESCRIPTIONS.freshnessTierPolicy).toBe('freshness tier policy');
    expect(CLI_FLAG_DESCRIPTIONS.statusFreshnessTierPolicy).toBe(
      "freshness tier policy to evaluate against (default: the cached entry's own tier)"
    );
    expect(CLI_FLAG_DESCRIPTIONS.fetchTtl).toBe(
      'predicted lifespan: number + h/d/w/m/y (m = months), e.g. "2h", "7d", "6m"'
    );
    expect(CLI_FLAG_DESCRIPTIONS.importTtl).toBe(
      'predicted lifespan of the data (e.g. "24h", "7d")'
    );
    expect(CLI_FLAG_DESCRIPTIONS.statusTtl).toBe(
      'custom TTL duration to evaluate against (e.g. "2h", "7d")'
    );
    expect(CLI_FLAG_DESCRIPTIONS.fetchStorage).toBe(
      'override where this result is cached (secrets always stored globally)'
    );
    expect(CLI_FLAG_DESCRIPTIONS.importStorage).toBe(
      'override where this note is cached (secrets always stored globally)'
    );
    expect(CLI_FLAG_DESCRIPTIONS.fetchTopic).toBe(
      'the main category/topic of the research for metadata tagging'
    );
    expect(CLI_FLAG_DESCRIPTIONS.importTopic).toBe('the main topic for this research note');
    expect(CLI_FLAG_DESCRIPTIONS.filterTopic).toBe('filter by exact topic (case-insensitive)');
    expect(CLI_FLAG_DESCRIPTIONS.fetchTags).toBe(
      'taxonomic tags for this research (can be repeated)'
    );
    expect(CLI_FLAG_DESCRIPTIONS.importTags).toBe('taxonomic tags (can be repeated)');
    expect(CLI_FLAG_DESCRIPTIONS.filterTags).toBe('filter by tags (must match all tags specified)');
  });

  it('formats status and inspect label/value rows with the existing padding', () => {
    expect(formatHumanField('URL', 'https://example.com')).toBe(
      'URL:                      https://example.com'
    );
    expect(formatHumanField('Cache Key', 'abc123')).toBe(
      'Cache Key:                abc123'
    );
    expect(formatHumanFields([
      ['Status', 'miss'],
      ['Freshness', 'none'],
    ])).toEqual(['Status:                   miss', 'Freshness:                none']);
  });

  it('widens labels when metadata keys exceed the default width', () => {
    expect(formatHumanField('very_long_frontmatter_key', 'value')).toBe(
      'very_long_frontmatter_key: value'
    );
  });
});
