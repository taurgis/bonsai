import { describe, expect, it } from 'vitest';
import { CLI_FLAG_DESCRIPTIONS, formatHumanField, formatHumanFields } from './cli-presentation.js';

describe('CLI presentation helpers', () => {
  it('keeps shared flag descriptions centralized', () => {
    expect(CLI_FLAG_DESCRIPTIONS.freshnessTierPolicy).toBe('freshness tier policy');
    expect(CLI_FLAG_DESCRIPTIONS.statusFreshnessTierPolicy).toBe(
      "freshness tier policy to evaluate; when omitted, uses the cached entry's own tier"
    );
    expect(CLI_FLAG_DESCRIPTIONS.fetchTtl).toBe(
      'TTL duration for freshness (e.g. "2h", "7d", "6m")'
    );
    expect(CLI_FLAG_DESCRIPTIONS.importTtl).toBe(
      'TTL duration for imported note freshness (e.g. "2h", "7d", "6m")'
    );
    expect(CLI_FLAG_DESCRIPTIONS.statusTtl).toBe(
      'TTL duration to evaluate freshness (e.g. "2h", "7d", "6m")'
    );
    expect(CLI_FLAG_DESCRIPTIONS.maxAge).toBe(
      'maximum cache age to accept (e.g. "2h", "7d", "6m")'
    );
    expect(CLI_FLAG_DESCRIPTIONS.fetchStorage).toBe(
      'override where this result is cached (secrets always stored globally)'
    );
    expect(CLI_FLAG_DESCRIPTIONS.importStorage).toBe(
      'override where this note is cached (secrets always stored globally)'
    );
    expect(CLI_FLAG_DESCRIPTIONS.fetchTopic).toBe('main research topic for metadata');
    expect(CLI_FLAG_DESCRIPTIONS.importTopic).toBe('main topic for this research note');
    expect(CLI_FLAG_DESCRIPTIONS.filterTopic).toBe('exact topic (case-insensitive)');
    expect(CLI_FLAG_DESCRIPTIONS.fetchTags).toBe(
      'taxonomic tags for this research (can be repeated)'
    );
    expect(CLI_FLAG_DESCRIPTIONS.importTags).toBe('taxonomic tags (can be repeated)');
    expect(CLI_FLAG_DESCRIPTIONS.filterTags).toBe('tags to require (must match all)');
    expect(CLI_FLAG_DESCRIPTIONS.format).toBe('output format');
    expect(CLI_FLAG_DESCRIPTIONS.readOnly).toBe(
      '(alias: --plan) block filesystem writes/deletes; network fetches still run; also honored via BONSAI_READ_ONLY/BONSAI_PLAN_MODE'
    );
    expect(CLI_FLAG_DESCRIPTIONS.sourceUrlGlob).toBe(
      'source URL glob (case-insensitive, supports * wildcard)'
    );
    expect(CLI_FLAG_DESCRIPTIONS.listArtifactType).toBe(
      'artifact type; section children are omitted from list - use inspect to see them'
    );
    expect(CLI_FLAG_DESCRIPTIONS.pruneArtifactType).toBe(
      'artifact type to prune, including section children'
    );
  });

  it('formats status and inspect label/value rows with the existing padding', () => {
    expect(formatHumanField('URL', 'https://example.com')).toBe(
      'URL:                      https://example.com'
    );
    expect(formatHumanField('Cache Key', 'abc123')).toBe('Cache Key:                abc123');
    expect(
      formatHumanFields([
        ['Status', 'miss'],
        ['Freshness', 'none'],
      ])
    ).toEqual(['Status:                   miss', 'Freshness:                none']);
  });

  it('widens labels when metadata keys exceed the default width', () => {
    expect(formatHumanField('very_long_frontmatter_key', 'value')).toBe(
      'very_long_frontmatter_key: value'
    );
  });
});
