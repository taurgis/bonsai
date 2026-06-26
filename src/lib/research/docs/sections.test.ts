import { describe, it, expect } from 'vitest';
import { splitMarkdownSections, slugifyHeading, headingPlainText } from './sections.js';

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

describe('headingPlainText', () => {
  it('reduces an inline link heading to its rendered text', () => {
    expect(
      headingPlainText('[API documentation](https://prismjs.com/extending.html#api-documentation)')
    ).toBe('API documentation');
  });

  it('strips images, reference links, code, and emphasis markers', () => {
    expect(headingPlainText('![logo](a.png) Title')).toBe('logo Title');
    expect(headingPlainText('See [the guide][guide]')).toBe('See the guide');
    expect(headingPlainText('**Bold** and _italic_ and `code`')).toBe('Bold and italic and code');
  });

  it('tolerates parentheses inside a link target without leaving a dangling )', () => {
    expect(headingPlainText('[docs](https://en.wikipedia.org/wiki/URL_(disambiguation))')).toBe(
      'docs'
    );
  });

  it('leaves plain headings untouched', () => {
    expect(headingPlainText('Class: URL')).toBe('Class: URL');
  });
});

describe('splitMarkdownSections (T-22)', () => {
  it('anchors and breadcrumbs use rendered text when a heading contains a Markdown link', () => {
    const md =
      '## Intro\n\ntext\n\n## [API documentation](https://prismjs.com/extending.html#api-documentation)\n\nbody';
    const section = splitMarkdownSections(md).find((s) => s.headingPath === 'API documentation');
    expect(section).toBeDefined();
    expect(section?.anchor).toBe('api-documentation');
  });

  it('strips inline code in a heading end-to-end (anchor, breadcrumb, and raw content)', () => {
    const md = '## Intro\n\ntext\n\n## `fs.readFile()`\n\nbody';
    const section = splitMarkdownSections(md).find((s) => s.anchor === 'fsreadfile');
    expect(section?.headingPath).toBe('fs.readFile()');
    // content keeps the original raw heading line, including backticks
    expect(section?.content).toContain('## `fs.readFile()`');
  });

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
