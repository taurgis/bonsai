// Maps a rendered documentation page to its public Markdown/MDX source. Every mapper returns a
// candidate URL only; callers MUST validate it with a real fetch before trusting it (T-19). A
// repository link alone is never "supported source mapping". All inputs are untrusted.

export interface GithubSource {
  repository: string; // owner/repo
  branch: string;
  path: string;
  rawUrl: string;
}

const GITHUB_EDIT_BLOB =
  /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:edit|blob)\/([^/]+)\/(.+)$/i;

/**
 * Converts a GitHub `edit`/`blob` URL into a raw.githubusercontent.com URL. Returns null for any
 * URL that is not a recognized GitHub edit/blob link, so callers never fabricate a raw URL.
 */
export function parseGithubSourceLink(href: string): GithubSource | null {
  const match = href.match(GITHUB_EDIT_BLOB);
  if (!match) return null;
  const [, owner, repo, branch, rawPath] = match;
  // Strip query/hash; a source path never legitimately contains them.
  const path = rawPath!.split(/[?#]/)[0]!;
  if (!path || path.includes('..')) return null;
  return {
    repository: `${owner}/${repo}`,
    branch: branch!,
    path,
    rawUrl: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`,
  };
}

// Node.js API docs: https://nodejs.org/api/url.html -> nodejs/node/doc/api/url.md on the release
// line. Deterministic and fixture-proven; mapping is advertised only after a successful fetch.
const NODE_API =
  /^https?:\/\/nodejs\.org\/(?:[a-z-]+\/)?(?:docs\/)?(?:latest(?:-v\d+\.x)?\/)?api\/([a-z_]+)\.html/i;

export function mapNodeApiSource(url: string): GithubSource | null {
  const match = url.match(NODE_API);
  if (!match) return null;
  const name = match[1]!;
  const path = `doc/api/${name}.md`;
  return {
    repository: 'nodejs/node',
    branch: 'main',
    path,
    rawUrl: `https://raw.githubusercontent.com/nodejs/node/main/${path}`,
  };
}

// MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/...  ->  mdn/content
// files/en-us/web/javascript/.../index.md (content paths are lowercased).
const MDN_DOCS = /^https?:\/\/developer\.mozilla\.org\/([a-zA-Z-]+)\/docs\/(.+?)\/?$/;

export function mapMdnSource(url: string): GithubSource | null {
  const match = url.match(MDN_DOCS);
  if (!match) return null;
  const locale = match[1]!.toLowerCase();
  const slug = match[2]!.split(/[?#]/)[0]!.toLowerCase();
  if (slug.includes('..')) return null;
  const path = `files/${locale}/${slug}/index.md`;
  return {
    repository: 'mdn/content',
    branch: 'main',
    path,
    rawUrl: `https://raw.githubusercontent.com/mdn/content/main/${path}`,
  };
}

// VitePress route Markdown: a docs page at /guide/intro.html (or /guide/intro) also serves
// /guide/intro.md. Returns the candidate `.md` route URL; validate before use (T-24/T-19).
export function vitepressRouteMarkdown(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  let path = parsed.pathname;
  if (path.endsWith('/')) path += 'index';
  path = path.replace(/\.html$/, '');
  if (path.endsWith('.md')) return null;
  parsed.pathname = `${path}.md`;
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString();
}

/**
 * Tries every known URL->source mapper in turn. Returns the first candidate, or null. The result
 * is a CANDIDATE; it must be validated by fetching before being recorded as a verified source.
 */
export function mapUrlToSource(url: string): GithubSource | null {
  return mapNodeApiSource(url) ?? mapMdnSource(url);
}
