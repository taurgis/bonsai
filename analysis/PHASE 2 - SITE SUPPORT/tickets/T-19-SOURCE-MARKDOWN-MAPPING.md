# T-19: Prefer Public Markdown/MDX Source When Available

## Goal

Fetch and cache public Markdown/MDX source for docs pages when it is discoverable and higher fidelity than rendered HTML.

## Evidence

- Next.js exposes `https://github.com/vercel/next.js/edit/canary/docs/index.mdx`.
- Vue exposes `https://github.com/vuejs/docs/edit/main/src/guide/introduction.md`.
- Vite exposes `https://github.com/vitejs/vite/edit/main/docs/guide/index.md`.
- Prisma exposes `https://github.com/prisma/docs/edit/main/apps/docs/content/docs/(index)/index.mdx`.
- Node API docs map predictably from `/api/url.html` to `nodejs/node/doc/api/url.md`.
- MDN content is public in `mdn/content`.

## Scope

- Convert GitHub `edit` and `blob` URLs to raw source URLs.
- Add source URL normalization and provenance fields.
- Parse Markdown/MDX frontmatter.
- Sanitize embedded HTML in source Markdown/MDX.
- Resolve relative links against the public docs URL and source URL where possible.
- Verify raw source URLs with conditional fetch metadata when possible.
- Add generic mappers:
  - GitHub edit link.
  - VitePress editLink pattern and hash map.
  - Node `/api/*.html` to `doc/api/*.md`.
  - MDN URL to `mdn/content` path.

## Out of Scope

- Executing MDX.
- Rendering custom MDX components.
- Private repository access.

## Acceptance Criteria

- Vue, Vite, Next.js, Prisma sampled pages can resolve a source Markdown/MDX URL.
- Node `url.html` resolves to the corresponding source Markdown path.
- MDN URL-to-source mapping is fixture-proven before being advertised as supported.
- Source-based artifacts preserve code fences better than HTML output where applicable.
- Artifact metadata records both page URL and source URL.
- Source fetch failures fall back to HTML extraction without corrupting cache.
- A public repository link alone does not count as supported source mapping.

## Validation

```bash
pnpm test -- --run src/sites src/lib/research
pnpm type-check
```
