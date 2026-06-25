import { describe, it, expect } from 'vitest';
import {
  parseGithubSourceLink,
  mapNodeApiSource,
  mapMdnSource,
  vitepressRouteMarkdown,
  mapUrlToSource,
} from './source-map.js';

describe('parseGithubSourceLink', () => {
  it('converts an edit URL to a raw URL', () => {
    const s = parseGithubSourceLink(
      'https://github.com/vuejs/docs/edit/main/src/guide/introduction.md'
    );
    expect(s?.repository).toBe('vuejs/docs');
    expect(s?.branch).toBe('main');
    expect(s?.path).toBe('src/guide/introduction.md');
    expect(s?.rawUrl).toBe(
      'https://raw.githubusercontent.com/vuejs/docs/main/src/guide/introduction.md'
    );
  });

  it('converts a blob URL to a raw URL', () => {
    const s = parseGithubSourceLink('https://github.com/vercel/next.js/blob/canary/docs/index.mdx');
    expect(s?.rawUrl).toBe(
      'https://raw.githubusercontent.com/vercel/next.js/canary/docs/index.mdx'
    );
  });

  it('strips a trailing query/hash from the path', () => {
    const s = parseGithubSourceLink('https://github.com/o/r/edit/main/docs/a.md?plain=1#L3');
    expect(s?.path).toBe('docs/a.md');
  });

  it('rejects non-GitHub and path-traversal links', () => {
    expect(parseGithubSourceLink('https://gitlab.com/o/r/edit/main/a.md')).toBeNull();
    expect(parseGithubSourceLink('https://example.com/page')).toBeNull();
    expect(parseGithubSourceLink('https://github.com/o/r/edit/main/../../etc/passwd')).toBeNull();
  });
});

describe('mapNodeApiSource', () => {
  it('maps a Node API page to doc/api/*.md', () => {
    const s = mapNodeApiSource('https://nodejs.org/api/url.html');
    expect(s?.repository).toBe('nodejs/node');
    expect(s?.path).toBe('doc/api/url.md');
  });

  it('maps versioned and docs-prefixed Node API URLs', () => {
    expect(mapNodeApiSource('https://nodejs.org/docs/latest-v22.x/api/fs.html')?.path).toBe(
      'doc/api/fs.md'
    );
  });

  it('returns null for non-API Node pages', () => {
    expect(mapNodeApiSource('https://nodejs.org/en/about')).toBeNull();
  });
});

describe('mapMdnSource', () => {
  it('maps an MDN page to mdn/content files path', () => {
    const s = mapMdnSource('https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference');
    expect(s?.repository).toBe('mdn/content');
    expect(s?.path).toBe('files/en-us/web/javascript/reference/index.md');
  });

  it('returns null for non-docs MDN URLs', () => {
    expect(mapMdnSource('https://developer.mozilla.org/en-US/blog/')).toBeNull();
  });

  it('rejects a path-traversal slug', () => {
    expect(
      mapMdnSource('https://developer.mozilla.org/en-US/docs/Web/../../etc/passwd')
    ).toBeNull();
  });
});

describe('vitepressRouteMarkdown', () => {
  it('derives the .md route for an .html page', () => {
    expect(vitepressRouteMarkdown('https://vitepress.dev/guide/what-is-vitepress.html')).toBe(
      'https://vitepress.dev/guide/what-is-vitepress.md'
    );
  });

  it('derives the .md route for an extensionless page and a directory', () => {
    expect(vitepressRouteMarkdown('https://vitepress.dev/guide/what-is-vitepress')).toBe(
      'https://vitepress.dev/guide/what-is-vitepress.md'
    );
    expect(vitepressRouteMarkdown('https://vitepress.dev/guide/')).toBe(
      'https://vitepress.dev/guide/index.md'
    );
  });

  it('returns null when already a .md route', () => {
    expect(vitepressRouteMarkdown('https://vitepress.dev/guide/intro.md')).toBeNull();
  });

  it('returns null for an unparseable URL', () => {
    expect(vitepressRouteMarkdown('not a url')).toBeNull();
  });
});

describe('mapUrlToSource', () => {
  it('dispatches to the matching mapper', () => {
    expect(mapUrlToSource('https://nodejs.org/api/url.html')?.repository).toBe('nodejs/node');
    expect(mapUrlToSource('https://developer.mozilla.org/en-US/docs/Web/HTTP')?.repository).toBe(
      'mdn/content'
    );
    expect(mapUrlToSource('https://example.com/x')).toBeNull();
  });
});
