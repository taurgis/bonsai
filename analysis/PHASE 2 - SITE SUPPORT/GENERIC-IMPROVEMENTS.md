# Generic System Improvements for Phase 2

## Executive Summary

The generic website-to-Markdown cache should remain the default ingestion path, but Phase 2 needs a layered pipeline:

1. Detect the docs engine and site capabilities.
2. Discover canonical page/source/search metadata.
3. Probe public machine-readable docs artifacts such as `llms.txt`, route `.md`, and local search indexes.
4. Prefer public Markdown/MDX/LLM source when available and relevant.
5. Otherwise extract static HTML.
6. Automatically retry with rendered extraction when static output is missing, low-quality, or SPA-like.
7. Normalize framework-specific HTML patterns before Turndown.
8. Split and index large references into section-level artifacts.

This covers most researched sites without turning the project into a pile of one-off parsers.

## 1. Add Docs-Engine Detection

Detect common docs engines from HTML markers and global data objects:

| Engine | Detection signals | Sites in research | Generic capabilities |
| --- | --- | --- | --- |
| VitePress | `window.__VP_HASH_MAP__`, `window.__VP_SITE_DATA__`, VitePress classes | Vue, Vite | Page map, sidebar/nav extraction, edit-link pattern, local search config, source `.md` mapping |
| Docusaurus | `__docusaurus`, docs route data, Docusaurus classes | Redux Toolkit and many OSS docs | Sidebar data, route manifests, source edit URL, local/Algolia search plugin config |
| Astro Starlight | `meta generator Astro`, `meta generator Starlight`, `data-pagefind-body`, `sl-doc-search` | Astro docs | Pagefind body markers, DocSearch component, Starlight content structure |
| Next.js docs | `__NEXT_DATA__` or App Router flight payloads, `/_next/static/` | React, Next.js, Tailwind, Prisma | RSC/flight data extraction, GitHub edit links, app router source mapping |
| Nextra/Fumadocs | Next.js assets plus framework classes, RSC page maps, `frontMatter.filePath`, `llms.txt` signals | Nextra, Fumadocs | Page map extraction, source-path hints, `llms.txt` preference |
| MkDocs | MkDocs footer/comment, `mkdocs_search_modal`, `search/search_index.json` | MkDocs, Material for MkDocs | Local search index, edit links, static article extraction |
| Sphinx | `searchindex.js`, Sphinx theme classes, `DOCUMENTATION_OPTIONS`, versioned paths | Sphinx, Python/scientific docs | Search index parser, section chunking, optional intersphinx inventory |
| GitBook/ReadMe/Mintlify | platform generator/meta, hidden AI-agent hints, `llms.txt`, `.md` links, platform image/CDN patterns | GitBook, ReadMe, Mintlify | `llms.txt` discovery, page Markdown preference, managed-platform cleanup |
| Docsify | `window.$docsify`, hash routing, app shell, edit link to Markdown | Docsify | Rendered fallback or source Markdown mapping, sidebar Markdown discovery |
| Hugo/Jekyll docs themes | theme footer/classes, static search JSON, GitHub Pages/Jekyll/Hugo markers | Docsy, Just the Docs | Static link discovery, local search data, root-page chrome cleanup |
| Generated static API docs | stable heading anchors, source repo path patterns, long single page | Node.js, MDN, TypeScript | Section chunking, source Markdown fetch, API symbol index |
| SPA docs | small initial body, app shell, script-heavy HTML, static Readability failure | NestJS, TanStack | Automatic rendered fallback, site default `rendered: true` when confirmed |

## 2. Add a Capability Model to `SiteModule`

The current `SiteModule` type supports `defaults`, `fetchPage`, and `search`. Extend it so generic detectors can provide the same capabilities as explicit modules:

```ts
interface SiteCapabilities {
  docsEngine?: 'vitepress' | 'docusaurus' | 'starlight' | 'next' | 'generated-static' | 'spa';
  framework?: 'mkdocs' | 'sphinx' | 'nextra' | 'fumadocs' | 'gitbook' | 'mintlify' | 'readme' | 'docsify' | 'hugo-docsy' | 'jekyll-just-the-docs' | string;
  machineReadable?: Array<{
    type: 'llms.txt' | 'llms-full.txt' | 'route-markdown' | 'search-index' | 'sitemap' | 'source-edit-link';
    url: string;
    evidence: 'verified' | 'signal';
  }>;
  source?: {
    type: 'markdown' | 'mdx' | 'html';
    url: string;
    repository?: string;
    branch?: string;
    path?: string;
  };
  search?: {
    provider: 'algolia-docsearch' | 'vitepress-local' | 'pagefind' | 'docusaurus-local' | 'mkdocs-local' | 'sphinx-searchindex' | 'jekyll-json' | 'readme-algolia' | 'custom';
    publicEndpoint?: string;
    indexName?: string;
    appId?: string;
    apiKey?: string;
  };
  pageMap?: Array<{ title: string; url: string; sourcePath?: string }>;
}
```

This lets the system store provenance like `site_module_id`, `docs_engine`, `source_url`, `source_path`, `search_provider`, and `capture_method` in frontmatter.

## 3. Add Machine-Readable Artifact Preference

The framework research found multiple docs engines that publish better machine-readable artifacts than their HTML pages:

| Artifact | Verified frameworks | Why it matters | Guardrail |
| --- | --- | --- | --- |
| `llms.txt` | GitBook, Rspress, Mintlify, Fumadocs, ReadMe | Site-level page discovery designed for AI/LLM consumers | Confirm text content, same docs origin/base path, and non-error body |
| Route `.md` | VitePress, Rspress, GitBook | Direct page Markdown without GitHub source inference | Only use after HTTP 200 and content-type/body validation |
| Local search JSON | MkDocs, Material for MkDocs, Just the Docs | Full indexed page discovery without remote API keys | Parse as data, not script |
| `searchindex.js` | Sphinx | Search/page discovery for many Python/scientific docs | Extract static data safely; never eval untrusted JS |
| Edit/source links | VitePress, Starlight, MkDocs, Docsify, GitBook | Raw source mapping and provenance | Convert only recognized GitHub edit/blob URLs |

Preferred order for documentation pages:

1. If a scoped `llms.txt` is advertised or conventional and validates, store it as a site-index artifact.
2. If the requested page has a verified route `.md` or linked Markdown route, store that as the detailed page source.
3. If an edit/source link maps safely to raw Markdown/MDX, use it as source.
4. If no source artifact validates, extract static HTML.
5. If static HTML is low quality or SPA-like, retry rendered extraction.

This is intentionally a preference order, not an unconditional shortcut. An `llms.txt` index is for discovery; it does not replace exact page capture unless it contains full page content or links to a page-level Markdown artifact.

## 4. Prefer Markdown/MDX Source When Available

Rendered HTML is a compatibility fallback. For documentation, source Markdown/MDX is often better because it preserves:

- Code fences and language tags.
- Tabs and admonitions as structured source.
- Frontmatter title/description/sidebar metadata.
- Internal links before the framework rewrites them.
- Edit provenance.

Generic source mapping strategies:

- Use explicit edit links when present, for example `github.com/.../edit/<branch>/<path>`.
- Convert GitHub edit/blob URLs to raw URLs.
- Use VitePress `editLink.pattern` plus `__VP_HASH_MAP__`.
- Use Docusaurus edit URLs and sidebar manifests.
- Use known generated-doc paths for Node (`doc/api/*.md`) and MDN (`mdn/content/files/.../index.md`).
- Use route-level `.md` for VitePress, Rspress, and GitBook only after endpoint validation.
- Use `llms.txt` as a discovery/source-index artifact for GitBook, Rspress, Mintlify, Fumadocs, and ReadMe.

Do not blindly trust raw Markdown as safe. Treat it as untrusted input, sanitize embedded HTML, normalize links, and still pass it through the same artifact schema.

## 5. Make Search Connectors Generic

The current local cache search only finds what has already been fetched. Phase 2 needs remote search connectors so agents can discover the right page before caching it.

Prioritize:

1. Algolia DocSearch connector.
   Vue exposes `appId`, public search `apiKey`, `indexName`, and facet filters in `window.__VP_SITE_DATA__`. Other sites may expose only partial signals such as an Algolia DSN preconnect or a DocSearch button; those must be treated as discovery leads until a fixture proves the app id, index, key, and query endpoint.

2. VitePress local search connector.
   Vite uses VitePress `search.provider = local` with MiniSearch options in `__VP_SITE_DATA__`. The index is bundled as site assets. Fetch and query it instead of crawling all pages.

3. Pagefind connector.
   Starlight pages can mark indexable regions with `data-pagefind-body`, but the presence of that marker does not by itself prove a fetchable Pagefind index. Use this only after detecting the public index files.

4. Docusaurus local/search connector.
   Docusaurus sites often ship route and docs metadata. Extract the sidebar and local search index only when the route metadata or search plugin payload is visible in fixtures. A Docusaurus-looking page is not enough to assume a connector.

5. Site-specific connectors only where generic discovery fails.

6. Static local search indexes.
   MkDocs and Material for MkDocs expose `/search/search_index.json`. Just the Docs exposes `assets/js/search-data.json`. These should be prioritized over remote search APIs because they are deterministic, unauthenticated, and easy to fixture.

7. Sphinx search index.
   Sphinx exposes `searchindex.js`. Parse the embedded data structure without evaluating JavaScript. This also unlocks a large class of Python and scientific docs.

8. Managed platform search.
   ReadMe exposes Algolia app/token/filter metadata in page JSON. This is useful but riskier than local indexes, so the connector must be fixture-backed and provider-specific.

Search result URLs must be normalized and then routed through `research <url>` so the cache remains the durable source of content.

Connector rule: every remote search provider must include a fixture with the raw config payload, one mocked query response, and one live-search smoke test that can be skipped when network is unavailable.

## 6. Improve Extraction Quality Gates

The extraction result needs quality checks that reflect agent usefulness, not just character count.

Add warnings or failures for:

- Base64/data URI images in Markdown.
- More image links than headings or paragraphs.
- Footer/nav/control text ratio above a threshold.
- Code blocks where multiple commands/imports are collapsed onto one line.
- Very large pages exceeding a section token threshold.
- Search or theme controls appearing in extracted content.
- Hidden app shell text such as "loading" or empty navigation dominating output.
- Landing/index pages where card/image/navigation content dominates the article body.
- Error pages captured as successful extraction, especially GitHub Pages 404 pages and hosted-platform soft 404s.
- `llms.txt` or `.md` probes that return HTML, redirects to an unrelated origin, or generic landing pages.

The CLI should expose these in JSON as stable `qualityNotes` codes, not only prose.

## 7. Preserve Code Blocks Better

Observed defects:

- Tailwind: `npm create vite@latest my-projectcd my-project`.
- Tailwind: JavaScript imports and `defineConfig` collapse together.
- Redux Toolkit: multi-command examples collapsed into one line.
- Vite/Node: code fences are generally preserved, but long pages need section chunking.

Implementation options:

- Before Turndown, normalize Shiki/code-highlight HTML by converting each `.line` span into newline-delimited text.
- Prefer copy-button payloads only when trustworthy and associated with a visible code block.
- Preserve code block language labels from parent classes like `language-bash`, `language-ts`, `language-js`, `language-html`.
- Preserve framework tab groups as alternatives, for example npm/pnpm/yarn tabs in Starlight and Material for MkDocs.
- Add fixtures for Tailwind, Redux Toolkit, VitePress, Docusaurus, Starlight, Material for MkDocs, Fumadocs, Rspress, and Node.

## 8. Add Section-Level Chunking

Long API pages are technically extracted but awkward for agents:

- Node `url.html` produced about 17.5k detailed tokens.
- MDN reference pages can contain long related sections and compatibility data.

Add optional section artifacts:

- Keep one page-level artifact for provenance.
- Derive child artifacts keyed by normalized URL plus heading anchor.
- Store heading path, anchor, parent cache key, and token estimates.
- Let `research inspect` show child sections.
- Let `research search` rank section hits before whole-page hits.

## 9. Add Automatic Rendered Fallback

Observed cases:

- NestJS static extraction failed, rendered extraction succeeded with high confidence.
- TanStack Query uses browser fallback and returns high-confidence content.

Suggested fallback triggers:

- Readability parse failure.
- Extracted text below a minimum threshold.
- HTML contains SPA app shell markers and large script payloads.
- Main content selectors are empty before render.
- Site module or docs-engine detector sets `defaults.rendered = true`.
- Docsify/hash-router markers indicate client-side Markdown rendering and no verified source Markdown was found.

Rendered fallback should keep the same DNS, timeout, redirect, and body-size safety limits as static fetch.

## 10. Improve Landing Page Handling

Landing pages are often less article-like than reference pages:

- Astro docs landing page included large contributor image grids.
- TypeScript docs index included customizer/footer/base64 logo noise.
- Material for MkDocs root page extracted as a low-confidence short marketing snippet.
- Mintlify root page extracted mostly decorative imagery and marketing text despite a better `llms.txt` index.
- GitBook and Just the Docs root pages included repeated cover images or contributor/avatar grids.

Generic cleanup:

- Strip `data-pagefind-ignore`, footer, theme/customizer widgets, and known social/avatar galleries before Readability.
- Drop data URI images from Markdown.
- Detect pages that are navigation hubs and store them as "index" artifacts with extracted links rather than pretending they are detailed articles.

## 11. Do Not Overfit the First Parser Pack

Recommended implementation order:

1. Machine-readable artifact probing: scoped `llms.txt`, route `.md`, and validation.
2. VitePress detector and source/search support.
3. Static local search connectors: MkDocs JSON, Material for MkDocs JSON, Just the Docs JSON, Sphinx `searchindex.js`.
4. Code block and tab/admonition normalization.
5. Automatic rendered fallback.
6. GitHub edit/source mapper.
7. Starlight/Pagefind cleanup.
8. Docusaurus detector.
9. Next.js App Router/RSC extraction for Nextra, Fumadocs, Mintlify, Tailwind-style pages.
10. Long-reference chunking.
11. Managed platform modules only where generic `llms.txt`/Markdown/search support is insufficient.
12. Site modules only for remaining custom cases.
