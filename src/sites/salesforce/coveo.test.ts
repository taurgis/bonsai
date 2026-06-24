import { describe, it, expect } from 'vitest';
import {
  buildSearchPageUrl,
  normalizeHelpDocContentUrl,
  extractCoveoResults,
  isAllowedDocHost,
} from './coveo.js';

describe('salesforce coveo helpers', () => {
  it('buildSearchPageUrl puts the query in the hash, not the search string', () => {
    const url = new URL(buildSearchPageUrl('roles and permissions'));
    expect(url.pathname).toBe('/s/search-result');
    expect(url.searchParams.get('language')).toBe('en_US');
    expect(url.search).not.toContain('roles'); // query lives in the hash
    const hash = new URLSearchParams(url.hash.slice(1));
    expect(hash.get('q')).toBe('roles and permissions');
    expect(hash.get('t')).toBe('allResultsTab');
  });

  it('normalizeHelpDocContentUrl rewrites /help_doccontent to /s/articleView', () => {
    const raw =
      'https://help.salesforce.com/help_doccontent?id=sf.security_overview&language=en_US&release=248';
    const out = new URL(normalizeHelpDocContentUrl(raw));
    expect(out.pathname).toBe('/s/articleView');
    expect(out.searchParams.get('id')).toBe('sf.security_overview.htm');
    expect(out.searchParams.get('type')).toBe('5');
    expect(out.searchParams.get('language')).toBe('en_US');
    expect(out.searchParams.get('release')).toBe('248');
  });

  it('normalizeHelpDocContentUrl leaves unrelated and invalid URLs untouched', () => {
    const article = 'https://help.salesforce.com/s/articleView?id=sf.foo.htm&type=5';
    expect(normalizeHelpDocContentUrl(article)).toBe(article);
    expect(normalizeHelpDocContentUrl('not a url')).toBe('not a url');
  });

  it('isAllowedDocHost only accepts the two Salesforce doc hosts', () => {
    expect(isAllowedDocHost('help.salesforce.com')).toBe(true);
    expect(isAllowedDocHost('DEVELOPER.salesforce.com')).toBe(true);
    expect(isAllowedDocHost('evil.example.com')).toBe(false);
  });

  it('extractCoveoResults dedupes, validates host, normalizes, and respects limit', () => {
    const data = {
      results: [
        { title: 'A', clickUri: 'https://help.salesforce.com/s/articleView?id=sf.a.htm&type=5' },
        { title: 'Dup', clickUri: 'https://help.salesforce.com/s/articleView?id=sf.a.htm&type=5' },
        {
          title: 'B',
          excerpt: 'snippet text',
          raw: { clickuri: 'https://developer.salesforce.com/docs/b' },
        },
        { title: 'Offsite', clickUri: 'https://evil.example.com/x' },
        { title: 'Skip root', clickUri: 'https://help.salesforce.com/' },
        { title: 'No url' },
        { title: 'C', clickUri: 'https://help.salesforce.com/s/articleView?id=sf.c.htm&type=5' },
      ],
    };
    const results = extractCoveoResults(data, 2);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      url: 'https://help.salesforce.com/s/articleView?id=sf.a.htm&type=5',
      title: 'A',
    });
    expect(results[1]).toEqual({
      url: 'https://developer.salesforce.com/docs/b',
      title: 'B',
      snippet: 'snippet text',
    });
  });

  it('extractCoveoResults handles malformed payloads', () => {
    expect(extractCoveoResults(null, 10)).toEqual([]);
    expect(extractCoveoResults({}, 10)).toEqual([]);
    expect(extractCoveoResults({ results: 'nope' }, 10)).toEqual([]);
  });
});
