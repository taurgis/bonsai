# Phase 2 Implementation Status

This document records what Phase 2 actually shipped, what is intentionally signal-only, and what
is unsupported. It is the ground truth for T-16 through T-29. Source lives under
`src/lib/research/docs/` (the generic docs-awareness layer) plus pipeline wiring in
`src/commands/research.ts` and `src/commands/research/search.ts`.

## Design choice: generic-first, no new site modules

Phase 2 adds a generic **docs-engine capability layer** rather than per-site parsers. Detection,
machine-readable preference, source mapping, search connectors, code/landing cleanup, rendered
fallback, and section chunking all run generically for any site. The existing `SiteModule` shape is
unchanged and still used for the Salesforce Help / Salesforce Developer / TanStack / React modules.

## Ticket status

| Ticket | Status | Notes |
| --- | --- | --- |
| T-16 Docs-engine detection | **Implemented** | `docs/detect.ts` detects vitepress, docusaurus, starlight, next (+ nextra/fumadocs/mintlify), generated-static, spa, and frameworks mkdocs/material/sphinx/gitbook/readme/redocly/docsify/rspress/vuepress/just-the-docs/docsy. Capabilities + evidence levels in `docs/capabilities.ts`. Stored in frontmatter as `docs_engine`/`docs_framework` and exposed in JSON. |
| T-24 Machine-readable artifacts | **Implemented** | `docs/machine-readable.ts` probes conventional + advertised `llms.txt` and route `.md` (VitePress/Rspress/GitBook only). Validated same-origin, non-HTML, non-error before trust (`docs/validate.ts`). `fetchText` added to the fetcher. Mintlify/Fumadocs `.md` route is **not** assumed. |
| T-25 Static search indexes | **Implemented** | `docs/search-index.ts` parses MkDocs/Material `search_index.json`, Sphinx `searchindex.js` (sliced + `JSON.parse`, never `eval`), and Just the Docs `search-data.json`. Malformed indexes throw a stable error. |
| T-17 Code/tab fidelity | **Implemented (code lines + language); signal (tabs/admonitions)** | `docs/code-blocks.ts` rebuilds `.line`/`.token-line` spans into newline-delimited text, preserves `language-x` (Readability `keepClasses`), and drops copy buttons. Collapsed-code emits `quality:collapsed-code`. Tab/admonition **text** is preserved by Readability but not specially restructured. |
| T-18 Automatic rendered fallback | **Implemented** | `capture.ts` retries rendered when static extraction fails, the detector says SPA, or content is thin/low-confidence. Verified live on `docs.nestjs.com`. Static-good pages (Vue/Vite/MDN) are not rendered. Failed renders never overwrite usable static content. |
| T-19 Source Markdown/MDX | **Implemented** | `docs/source-map.ts` (GitHub edit/blob→raw, Node `/api/*.html`→`doc/api/*.md`, MDN→`mdn/content`), `docs/markdown-source.ts` (frontmatter + HTML sanitize). Preferred in `capture.ts` over HTML; falls back cleanly. A repo link alone is a signal, never a verified source. |
| T-20 Remote docs search | **Implemented (Algolia, MkDocs/Sphinx/Just-the-Docs); signal (VitePress-local auto-discovery)** | `docs/remote-search.ts` + `docs/remote-search-runner.ts`, wired as `research search --remote <url>`. Algolia DocSearch config is read from the page and queried at the documented endpoint. VitePress-local index **parsing/ranking** is implemented and fixture-proven, but live discovery of the hashed index asset URL remains signal-level (matches the SITE-MATRIX caveat). Unsupported sites degrade to local cache with a warning. |
| T-21 Landing-page cleanup + gates | **Implemented** | `docs/clean-dom.ts` strips `data-pagefind-ignore`, contributor/avatar/sponsor/customizer chrome, and `data:` images pre-Readability. `docs/quality-gates.ts` emits stable `quality:*` codes (base64-image, high-image-ratio, collapsed-code, oversized, index-hub, error-page) and flags index/hub pages (stored as `artifact_type: index`). |
| T-22 Section-level artifacts | **Implemented** | `docs/sections.ts` splits at H2/H3; `docs/section-artifacts.ts` writes hex-keyed `section` children linked by `parent_cache_key`, regenerating + archiving orphans on refresh. `research inspect` lists sections; `research search` ranks section hits above the page. Only pages > ~6k tokens are split. |
| T-26 Next/RSC page maps | **Implemented (page map + hints)** | `docs/rsc.ts` scans `__NEXT_DATA__`/`self.__next_f` as inert text for route/title/`filePath`. Page map stored in capabilities; source paths labeled unverified hints. Never executed. |
| T-27 Managed platforms | **Implemented via generic artifacts** | GitBook/ReadMe/Mintlify/Redocly handled through detection + `llms.txt`/route-`.md` preference + landing cleanup. ReadMe Algolia/OpenAPI metadata and Redocly's missing `llms.txt` are recorded as notes. No brittle per-page parser added. |
| T-28 Docsify | **Implemented** | Detected as spa+docsify (rendered recommended). Source Markdown from an edit link is preferred via the generic source path; rendered fallback otherwise. SPA hash routes (`#/...`) are preserved in cache keys (`url.ts`). |
| T-29 Fixture pack | **Implemented** | `src/lib/research/docs/__fixtures__/` holds one minimal fixture per detector family, positive + negative `llms.txt`/route-`.md`, MkDocs/Sphinx/Just-the-Docs/Algolia/VitePress-local search fixtures, code-fidelity fixtures, and negative error/Slate-404 fixtures. |
| T-23 Site modules | **Closed — not needed** | Evidence: the generic engine + source + search + rendered + code-fidelity layer covers angular/react/tailwind/svelte/mdn shapes from the analysis. Per "do not overfit the first parser pack," no new custom module was added. Existing Salesforce/TanStack/React modules are retained and still pass their tests. Revisit only if a future fixture proves the generic path insufficient for a specific site. |

## Signal-only (recorded, not trusted as working)

- Any `search` capability emitted by the detector (`vitepress-local`, `algolia-docsearch`, `pagefind`) is `evidence: signal` until a connector proves it.
- Next/RSC `filePath` values are source-path **hints**, never fetched as source unless a raw URL validates.
- VitePress-local search index **auto-discovery** (the hashed asset URL) is signal-level; the parser is proven.

## Unsupported

- Pagefind and Docusaurus remote search connectors (only detected as signals; no fixture-backed endpoint).
- Redocly `llms.txt` at the conventional path (404 in research; recorded as a note).
- Slate (sample URL was a GitHub Pages 404; kept as a negative fixture only).
- Authenticated/private search APIs and private repositories.

## Live validation (testing/regression)

The single live regression suite (`pnpm regression:suite`) drives both the custom site modules and
the generic `capturePage` pipeline. Its generic half covers 27 real documentation pages (popular
libraries + every docs engine) and asserts information-preservation (vs committed baselines) and
**zero chrome/menu/placeholder leakage** (`leakageSignals`). Promoted baseline: all clean, 0 leaks.
It surfaced and fixed several real bugs during this work:

- The edit-link detector grabbed the *first* GitHub link on a page, mistaking footer
  `CODE_OF_CONDUCT.md` links for the page source (Vite/React captured a bogus 3 KB artifact). Now
  only genuine `/edit/`-route or "edit this page" links are accepted.
- VitePress source Markdown embeds an authored `<audio>`/`<button>`/`<svg>` pronunciation widget;
  `sanitizeSourceMarkdown` now strips icon/media/interactive widgets from source.
- Text-less anchor links `[](url)` (icon/permalink leftovers) leaked a bare URL; `dropEmptyLinks`
  removes them on both the HTML and source paths.
- MDN raw source is KumaScript: `{{jsxref("Promise.all()")}}` is reduced to its display text and
  section/embed macros (`{{Compat}}`, `{{EmbedInteractiveExample}}`) are dropped — MDN-gated so
  Vue/Angular `{{ }}` interpolation is never touched.

Confirmed live: Tailwind install commands stay on separate lines (T-17), Redux multi-command blocks
preserved, Node/MDN map to GitHub source, NestJS auto-renders, Vue/Vite prefer route/source Markdown.

Known fidelity limitation: react.dev's Sandpack JSX examples extract as inline prose rather than
fenced blocks (no per-site parser added per T-23). Content is preserved; formatting is imperfect.

## Security

Algolia DocSearch config (`appId`/`apiKey`/`indexName`) is read from untrusted page HTML and
interpolated into the request URL, so all three are format-validated before use to prevent SSRF
(an `appId` like `evil.com/x` is rejected). `fetchText`/`postJson` keep the same DNS/timeout/size
guards as the HTML fetcher.

## New JSON / frontmatter fields

`artifact_type` (now also `index`/`section`), `docs_engine`, `docs_framework`, `source_doc_url`,
`search_provider`, `parent_cache_key`, `section_anchor`, `section_heading_path`. The `research`
command JSON adds `artifactType`, `docsEngine`, `docsFramework`, `sourceDocUrl`, `searchProvider`.
