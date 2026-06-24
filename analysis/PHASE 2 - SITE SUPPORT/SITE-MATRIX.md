# Phase 2 Site Matrix

## Summary Table

| Site | Docs engine shape | CLI extraction observed | Default cache sufficient? | Markdown or source docs | Search backend | Evidence level | Parser priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| React | Next.js site | Static, high confidence, clean reference index | Mostly yes for page content | Public docs source expected, but no direct edit link observed on sampled page | Algolia/DocSearch signal in HTML; endpoint not verified | Signal | P2 generic Next.js/source discovery |
| Next.js | Next.js site | Static, high confidence, clean docs index | Yes for article pages | Verified GitHub edit link to `vercel/next.js/docs/*.mdx` | Search UI observed; backend not verified | Mixed | P1 source mapping |
| Vue | VitePress | Static, high confidence, rich content | Yes for articles | Verified GitHub edit link to `vuejs/docs/src/*.md`; `__VP_HASH_MAP__` exposes page map | Verified public Algolia DocSearch config in site data | Verified | P0 VitePress generic |
| Angular | Custom Angular docs app | Static, high confidence on overview | Partial | Public Angular repo/docs app exists; sampled page had no direct edit link | `docs-content` asset signals observed; endpoint/index not verified | Signal | P1 custom/generic generated-index |
| Svelte | SvelteKit-style docs | Static, medium confidence, short but usable | Partial | Public source expected; URL-to-source mapping not verified | Search UI/custom search not verified as public API | Unverified | P2 rendered/source investigation |
| Vite | VitePress | Static, high confidence, good content | Yes for articles | Verified edit link to `vitejs/vite/docs/*.md`; `__VP_HASH_MAP__` exposes full page map | Verified VitePress local search config; index URL still needs fixture proof | Mixed | P0 VitePress generic |
| Astro | Astro Starlight | Static, medium confidence, noisy landing page | Partial | Public docs repo; route-to-source mapping not verified from sampled page | Starlight search component and `data-pagefind-body` markers observed; index not verified | Signal | P0 Starlight/Pagefind cleanup |
| Tailwind CSS | Next.js App Router | Static, medium confidence, code line breaks damaged | No for exact code examples | Public repo; sampled HTML did not expose direct source link | Algolia DSN preconnect and search UI observed; app key/index not verified | Signal | P1 Next.js RSC/code extraction |
| TypeScript | Custom static site | Static, medium confidence, footer/customizer/base64 noise | Partial | Public `microsoft/TypeScript-Website` source; URL mapping not verified | Site search observed; backend/index not verified | Signal | P1 chrome cleanup and source mapping |
| Node.js | Static generated API docs | Static, high confidence but huge | Yes but needs chunking | Public `nodejs/node/doc/api/*.md` source; deterministic mapping should be fixture-proven | Built-in docs search observed; connector lower priority than source/chunking | Mixed | P1 long-reference chunking/source mapping |
| MDN | Yari/content platform | Static, high confidence, good content | Mostly yes | Public `mdn/content` Markdown source; URL mapping needs fixture proof | Site search observed; public API/endpoint not verified in this task | Signal | P1 MDN source/search connector |
| Express | Static docs site | Static, medium confidence, short article | Yes for articles | Public docs source likely; mapping not verified | Search API not verified; sitemap/sidebar likely enough | Unverified | P2 static fallback |
| NestJS | SPA docs | Static failed; rendered high confidence | No without rendered fallback | Public docs repo likely; mapping not verified | Client-side search observed; public API not verified | Mixed | P0 automatic rendered fallback |
| Prisma | Next.js/docs platform | Static, medium confidence, concise landing page | Mostly for articles | Verified GitHub edit link to `prisma/docs/.../*.mdx` | Search UI observed; backend not verified | Mixed | P1 source mapping |
| TanStack Query | SPA/docs app | Rendered fallback high confidence | No without rendered fallback | Public repo docs source expected; mapping not verified | Local/custom search not verified | Mixed | P0 rendered default and source mapping |
| Redux Toolkit | Docusaurus | Static, high confidence, good content but code line breaks collapsed in some blocks | Partial | Public repo docs source expected; edit/source metadata not verified from sampled page | Docusaurus-style search shape expected; provider not verified | Signal | P1 Docusaurus source/search |

## Critical Findings

1. Static Readability is a strong first pass, but not a complete docs strategy.
   It extracts many pages well, but it cannot discover all pages, search indexes, source files, or framework-specific hidden data.

2. Docs-engine detection is higher leverage than one parser per library.
   VitePress, Docusaurus, Starlight, Next.js App Router, and generated static API docs each recur across many libraries.

3. Search should be a first-class site capability.
   Some docs sites expose enough client-side config to use Algolia DocSearch, local VitePress MiniSearch, or generated search bundles. Others only expose a visible search UI. Phase 2 must prove endpoint/index availability before implementing a connector. A cache-only search misses uncached pages.

4. Markdown source is often better than rendered HTML.
   Next.js, Vue, Vite, and Prisma exposed direct edit links in sampled pages; Node and MDN have public source repositories with predictable-looking mappings that still need fixture proof. Fetching source can preserve frontmatter, admonitions, code fences, and tabs better than HTML conversion when mapping is verified.

5. The most visible fidelity bug is code formatting.
   Tailwind and Redux Toolkit examples show adjacent commands/imports collapsed together. This is more damaging than page chrome because agents copy code examples.

## Recommended Phase 2 Defaults

- Keep static fetch first.
- Add automatic rendered fallback when extraction fails, content is too short, or SPA markers dominate the HTML.
- Add docs-engine detection before site-specific modules.
- Prefer source Markdown/MDX when a verified source URL is discoverable.
- Use rendered HTML only when source Markdown is unavailable or content is generated dynamically.
- Treat search connector output as discovery metadata, then pass selected URLs back through the normal cache artifact pipeline.
- Add extraction quality gates that fail or warn on base64 images, huge footer/navigation ratio, collapsed code, and oversized single artifacts.
