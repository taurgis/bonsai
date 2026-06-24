import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  looksLikeErrorPage,
  isSameDocsOrigin,
  validateTextArtifact,
  validateJsonArtifact,
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
});

describe('isSameDocsOrigin', () => {
  it('matches same hostname and rejects cross-origin', () => {
    expect(isSameDocsOrigin('https://x.com/llms.txt', 'https://x.com/docs')).toBe(true);
    expect(isSameDocsOrigin('https://evil.com/llms.txt', 'https://x.com/docs')).toBe(false);
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
});

describe('validateJsonArtifact', () => {
  it('accepts a non-empty object', () => {
    expect(validateJsonArtifact('{"docs":[{"location":"x"}]}').ok).toBe(true);
  });

  it('rejects invalid, empty, or HTML JSON', () => {
    expect(validateJsonArtifact('not json').ok).toBe(false);
    expect(validateJsonArtifact('{}').ok).toBe(false);
    expect(validateJsonArtifact('<!doctype html><html></html>').ok).toBe(false);
  });
});
