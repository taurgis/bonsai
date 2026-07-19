import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  looksLikeErrorPage,
  isSameDocsOrigin,
  validateTextArtifact,
  isValidatedMarkdownTwin,
} from './validate.js';

const FIXTURES = join(import.meta.dirname, '__fixtures__');
const load = (name: string) => readFileSync(join(FIXTURES, name), 'utf8');

describe('looksLikeErrorPage', () => {
  it('flags short 404/not-found bodies', () => {
    expect(looksLikeErrorPage('404 Not Found')).toBe(true);
    expect(looksLikeErrorPage("There isn't a GitHub Pages site here.")).toBe(true);
    expect(looksLikeErrorPage("The page you are looking for doesn't exist.")).toBe(true);
  });

  it('does not flag a long article that merely mentions 404', () => {
    const article = 'HTTP status codes. '.repeat(120) + 'The 404 code means not found.';
    expect(looksLikeErrorPage(article)).toBe(false);
  });

  it('flags SPA error shells that return HTTP 200', () => {
    expect(looksLikeErrorPage('## Something went wrong')).toBe(true);
    expect(looksLikeErrorPage('An error occurred while loading this page.')).toBe(true);
  });
});

describe('isSameDocsOrigin', () => {
  it('matches same hostname and rejects cross-origin', () => {
    expect(isSameDocsOrigin('https://x.com/llms.txt', 'https://x.com/docs')).toBe(true);
    expect(isSameDocsOrigin('https://evil.com/llms.txt', 'https://x.com/docs')).toBe(false);
  });

  it('returns false when a URL is unparseable', () => {
    expect(isSameDocsOrigin('not a url', 'https://x.com/docs')).toBe(false);
  });
});

describe('validateTextArtifact', () => {
  it('accepts a real llms.txt and route Markdown', () => {
    expect(validateTextArtifact(load('llms.txt')).ok).toBe(true);
    expect(validateTextArtifact(load('route.md')).ok).toBe(true);
  });

  it('rejects HTML returned for a text probe', () => {
    const v = validateTextArtifact(load('error-404.html'));
    expect(v.ok).toBe(false);
  });

  it('rejects empty bodies', () => {
    expect(validateTextArtifact('   ').ok).toBe(false);
  });

  it('rejects a plain-text soft error page with a reason', () => {
    // Non-HTML body that still reads like an error page (the looksLikeErrorPage branch).
    expect(validateTextArtifact('404: This page could not be found.')).toEqual({
      ok: false,
      reason: 'body looks like an error page',
    });
  });
});

describe('isValidatedMarkdownTwin', () => {
  const HOST = 'example.com';
  const twin = (overrides: Partial<Parameters<typeof isValidatedMarkdownTwin>[0]> = {}) => ({
    contentType: 'text/markdown; charset=utf-8',
    finalUrl: `https://${HOST}/doc.md`,
    content: '# Title\n\nEnough body text to clear the minimum length check for validation.\n',
    ...overrides,
  });

  it('accepts a same-host https response labeled text/markdown with a real body', () => {
    expect(isValidatedMarkdownTwin(twin(), HOST)).toBe(true);
  });

  it('rejects a non-markdown content type (e.g. an HTML shell)', () => {
    expect(isValidatedMarkdownTwin(twin({ contentType: 'text/html; charset=utf-8' }), HOST)).toBe(
      false
    );
  });

  it('rejects a redirect that left the allowed host', () => {
    expect(isValidatedMarkdownTwin(twin({ finalUrl: 'https://evil.example/doc.md' }), HOST)).toBe(
      false
    );
  });

  it('rejects a redirect that downgraded to plain http on the allowed host', () => {
    expect(isValidatedMarkdownTwin(twin({ finalUrl: `http://${HOST}/doc.md` }), HOST)).toBe(false);
  });

  it('rejects an empty body', () => {
    expect(isValidatedMarkdownTwin(twin({ content: '' }), HOST)).toBe(false);
  });

  it('rejects a body that is HTML despite a markdown content type', () => {
    expect(
      isValidatedMarkdownTwin(
        twin({ content: '<!DOCTYPE html><html><body>disguised</body></html>' }),
        HOST
      )
    ).toBe(false);
  });

  it('compares the allowed host case-insensitively', () => {
    expect(isValidatedMarkdownTwin(twin(), HOST.toUpperCase())).toBe(true);
  });
});
