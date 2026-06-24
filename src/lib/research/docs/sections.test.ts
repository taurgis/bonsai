import { describe, it, expect } from 'vitest';
import { splitMarkdownSections, slugifyHeading } from './sections.js';

const DOC = `# URL

Intro paragraph about URLs.

## URL strings and URL objects

Some text about strings.

## The WHATWG URL API

Overview text.

### Class: URL

Class details here.

### new URL(input)

Constructor details.

## Percent-encoding in URLs

Encoding text.
`;

describe('slugifyHeading', () => {
  it('produces GitHub-style anchors', () => {
    expect(slugifyHeading('new URL(input)')).toBe('new-urlinput');
    expect(slugifyHeading('Class: URL')).toBe('class-url');
    expect(slugifyHeading('`fs.readFile()`')).toBe('fsreadfile');
  });
});

describe('splitMarkdownSections (T-22)', () => {
  it('splits at H2/H3 boundaries with breadcrumb paths', () => {
    const sections = splitMarkdownSections(DOC);
    const anchors = sections.map((s) => s.anchor);
    expect(anchors).toContain('the-whatwg-url-api');
    expect(anchors).toContain('class-url');

    const classUrl = sections.find((s) => s.anchor === 'class-url');
    expect(classUrl?.headingPath).toBe('URL > The WHATWG URL API > Class: URL');
    expect(classUrl?.content).toContain('Class details here.');
  });

  it('does not split a short doc with fewer than two H2/H3', () => {
    expect(splitMarkdownSections('# Title\n\nJust one paragraph.')).toHaveLength(0);
  });

  it('ignores headings inside fenced code blocks', () => {
    const md = '## Real\n\ntext\n\n```\n## not a heading\n```\n\n## Second\n\nmore';
    const sections = splitMarkdownSections(md);
    expect(sections.map((s) => s.anchor)).toEqual(['real', 'second']);
  });
});
