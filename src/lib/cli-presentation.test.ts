import { describe, expect, it } from 'vitest';
import {
  CLI_FLAG_DESCRIPTIONS,
  formatHumanField,
  formatHumanFields,
  formatResultRowHeader,
  formatResultRowSourceUrls,
  formatResultRowTokens,
} from './cli-presentation.js';

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
    expect(CLI_FLAG_DESCRIPTIONS.fetchTopic).toBe(
      'main research topic for metadata (max 200 chars)'
    );
    expect(CLI_FLAG_DESCRIPTIONS.importTopic).toBe(
      'main topic for this research note (max 200 chars)'
    );
    expect(CLI_FLAG_DESCRIPTIONS.filterTopic).toBe('exact topic (case-insensitive)');
    expect(CLI_FLAG_DESCRIPTIONS.fetchTags).toBe(
      'taxonomic tags for this research (can be repeated, max 100 chars each)'
    );
    expect(CLI_FLAG_DESCRIPTIONS.importTags).toBe(
      'taxonomic tags (can be repeated, max 100 chars each)'
    );
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

  describe('formatResultRowHeader', () => {
    it('formats a numbered row with a topic', () => {
      const line = formatResultRowHeader(0, 'React Suspense', 'abc123');
      expect(line).toContain('1. [');
      expect(line).toContain('React Suspense');
      expect(line).toContain('Key: abc123');
    });

    it('falls back to the "(no topic)" label when topic is null', () => {
      expect(formatResultRowHeader(2, null, 'abc123')).toContain('(no topic)');
    });

    it('strips ANSI escape codes from an untrusted topic before printing it', () => {
      const esc = String.fromCharCode(27);
      const line = formatResultRowHeader(0, `${esc}[31mRED${esc}[0m`, 'abc123');
      expect(line).not.toContain(esc);
      expect(line).toContain('[31mRED[0m');
    });
  });

  describe('formatResultRowTokens', () => {
    it('formats compressed/detailed token counts', () => {
      expect(formatResultRowTokens({ compressed: 29, detailed: 65 })).toContain(
        'Tokens: compressed=29, detailed=65'
      );
    });

    it('falls back to 0 for a missing token estimate', () => {
      expect(formatResultRowTokens(null as any)).toContain('Tokens: compressed=0, detailed=0');
    });
  });

  describe('formatResultRowSourceUrls', () => {
    it('joins multiple source URLs with a comma', () => {
      expect(
        formatResultRowSourceUrls(['https://a.example.com', 'https://b.example.com'])
      ).toContain('Source URLs: https://a.example.com, https://b.example.com');
    });
  });
});
