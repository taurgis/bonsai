# Documentation Framework Matrix

## Summary Table

| Framework | Family | Static extraction observed | Default cache sufficient? | Source Markdown or AI artifact | Search surface | Evidence level | Generic priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Docusaurus | React SSG / SPA after hydration | High-confidence static article | Partial | MDX source usually available through edit links; exact edit URL not proven from sampled page output | DocSearch UI and Algolia DSN/preconnect visible; app config not proven | Mixed | P0 detector, P1 search/source |
| VitePress | Vue SSG / SPA after hydration | High-confidence static article | Yes for article body | Verified `.md` route and GitHub edit link | VitePress search button and site data; Vue/Vite samples prove local or Algolia variants | Verified | P0 source and page-map support |
| Starlight | Astro docs theme | High-confidence static article | Partial | Verified GitHub edit link to MDX source | Pagefind/body markers and Starlight search UI; index endpoint still needs fixture proof | Mixed | P0 Starlight cleanup |
| MkDocs | Python static docs generator | Medium-confidence root article | Yes for articles | Verified GitHub edit link on sampled page | Verified `/search/search_index.json` | Verified | P0 static search connector |
| Material for MkDocs | MkDocs theme | Low-confidence landing page | No for landing pages; likely yes for leaf pages | Source likely via repo/edit patterns; not proven from root page | Verified `/search/search_index.json` | Mixed | P0 landing-page + MkDocs search |
| Sphinx | Python/reStructuredText generator | High-confidence index with deep TOC | Yes but can be large | Source may be reStructuredText/MyST in repo; URL mapping not generic | Verified `searchindex.js` | Verified | P1 Sphinx search parser |
| Nextra | Next.js MDX docs framework | Medium-confidence static article | Partial | RSC payload exposes `filePath` and page map with `.mdx` paths | Search UI present; backend/index not proven | Mixed | P1 Next/RSC page-map extraction |
| Fumadocs | Next.js docs framework | Medium-confidence static article | Partial | Verified `llms.txt`; root `.md` route failed | Search UI present; endpoint not proven | Mixed | P1 llms.txt and RSC extraction |
| Mintlify | Managed Next.js docs platform | Low-confidence root capture | No for root pages | Verified `/docs/llms.txt`; simple `/docs.md` failed | Smart search UI/metadata; public search endpoint not proven | Mixed | P0 llms.txt, P1 platform cleanup |
| GitBook | Managed docs platform | Medium-confidence index capture, noisy images | Partial | Verified `llms.txt` and per-page `.md` route | Search UI present; endpoint not proven | Verified for source, signal for search | P0 llms.txt/Markdown preference |
| ReadMe | Managed docs and API platform | Low-confidence static article | No for many pages without platform handling | Verified `llms.txt`; page includes AI-agent hint | Algolia app/token/config visible in HTML metadata | Verified | P0 llms.txt, P1 ReadMe connector |
| Redocly | Managed/API docs platform | Medium-confidence static article | Partial | `llms.txt` returned 404 at tested path | Search/API docs platform signals; endpoint not proven | Mixed | P2 platform-specific investigation |
| Docsify | Client-side Markdown renderer | Rendered extraction medium-confidence | No without rendered or source fetch | Verified GitHub edit link to Markdown source | Docsify search plugin advertised; index shape not proven | Mixed | P1 rendered/source module |
| VuePress | Vue/Webpack or Vite SSG | High-confidence static article | Yes for article body | Markdown source model; direct edit/source not proven in sampled metadata | Search plugin common; endpoint not proven | Signal | P2 legacy detector |
| Rspress | React/Rsbuild SSG | High-confidence static article | Yes for article body | Verified `llms.txt` and generated `.md` route | Full-text search feature documented; endpoint not proven | Verified for source, signal for search | P0 llms.txt/Markdown preference |
| Docsy | Hugo docs theme | High-confidence static article | Yes for articles | Markdown source likely; no direct source mapping proven | Tested `/index.json` returned 404; search endpoint not proven | Mixed | P2 static theme detector |
| Just the Docs | Jekyll docs theme | High-confidence but noisy contributor section | Partial | GitHub source linked; route mapping not proven | Verified `assets/js/search-data.json` | Mixed | P1 Jekyll search/chrome cleanup |
| Slate | API docs generator | Tested URL produced GitHub Pages 404 | No result | Not verified | Not verified | Rejected | Do not implement until revalidated |

## Critical Findings

1. `llms.txt` is now a first-class source candidate.
   GitBook, Rspress, Mintlify, Fumadocs, and ReadMe exposed `llms.txt` in this task. The generic pipeline should probe it before spending tokens on HTML extraction, but only after confirming the returned body is text, relevant to the same docs site, and not an error page.

2. Route-level Markdown can be better than repository source mapping.
   VitePress and Rspress returned direct `.md` routes. GitBook returned a per-page `.md` route. These routes avoid GitHub path inference and preserve the generated docs content in a form intended for machines.

3. Local static search indexes are easier and safer than remote hosted search APIs.
   MkDocs, Material for MkDocs, Sphinx, and Just the Docs exposed public local search artifacts. These should be parsed before implementing brittle browser-search automation.

4. Next/RSC docs frameworks hide useful data in payloads.
   Nextra exposed page-map and `filePath` metadata in the Next flight payload. Fumadocs and Mintlify embed compiled MDX/source-like payloads in the page. The default Readability path discards these high-value structures.

5. Managed documentation platforms need a stricter artifact quality gate.
   Mintlify, GitBook, and ReadMe produce pages with large image URLs, marketing cards, custom CSS, platform metadata, or low article density. Their `llms.txt`/Markdown path is often more reliable than Readability.

6. Client-side Markdown renderers remain a special case.
   Docsify does not generate static HTML; rendered extraction worked, but source Markdown from the edit link is likely the cleaner path. The generic system should detect Docsify and fetch the backing Markdown when the route mapping is evident.
