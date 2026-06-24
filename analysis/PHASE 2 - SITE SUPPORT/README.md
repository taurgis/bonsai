# Phase 2: Site Support Analysis

## Goal

Phase 1 gives the research plugin a working generic URL-to-Markdown cache. Phase 2 should make it reliable across the documentation sites agents actually use: popular web frameworks, package docs, platform references, and docs engines.

The goal is not to hand-write a parser for every site. The goal is to extract generic patterns first, then add small site modules only where the generic path cannot recover search, navigation, source Markdown, rendered content, or high-fidelity code examples.

## Deliverables

- [Site matrix](SITE-MATRIX.md): cross-site summary of extraction quality, search backend, source Markdown availability, and recommended parser priority.
- [Selection rationale](SELECTION-RATIONALE.md): why these libraries and docs sites were selected.
- [Generic improvements](GENERIC-IMPROVEMENTS.md): system-level changes that cover most researched sites.
- [Self-audit](SELF-AUDIT.md): follow-up audit findings, confidence corrections, and residual risks.
- [Site notes](sites/): per-site analysis for the representative Phase 2 target set.
- [Framework notes](frameworks/): per-framework analysis for common documentation site generators and hosted documentation platforms.
- [Tickets](tickets/README.md): implementation-ready Phase 2 ticket sequence.

## Site Set

The representative set intentionally mixes docs engines and library categories:

- Core references: MDN, Node.js, TypeScript.
- Frontend frameworks: React, Next.js, Vue, Angular, Svelte.
- Build and styling tools: Vite, Astro, Tailwind CSS.
- Backend and data libraries: Express, NestJS, Prisma.
- State and server-state libraries: TanStack Query, Redux Toolkit.

This set is not exhaustive. It is chosen because it covers the extraction shapes most likely to recur: static article pages, Next.js app pages, VitePress sites, Starlight sites, Docusaurus sites, long API references, SPA docs, Algolia DocSearch, local search indexes, Pagefind-marked content, public GitHub Markdown/MDX sources, and custom generated docs.

## Documentation Framework Set

The framework set extends the site analysis from individual libraries to reusable docs engines:

- JavaScript documentation SSGs: Docusaurus, VitePress, VuePress, Rspress, Nextra, Fumadocs, Docsify.
- Python and classic static documentation: MkDocs, Material for MkDocs, Sphinx.
- Hugo and Jekyll documentation themes: Docsy, Just the Docs.
- Managed documentation platforms: GitBook, Mintlify, ReadMe, Redocly.
- API/reference pattern check: Slate was probed but the public sample URL returned a GitHub Pages 404 in this task, so it is treated as a rejected/needs-revalidation target rather than a supported framework.

The biggest new finding is that several modern documentation engines now expose AI-oriented source artifacts. VitePress, Rspress, GitBook, Mintlify, Fumadocs, and ReadMe all exposed either direct Markdown routes, `llms.txt`, or both in this task. The generic pipeline should detect and prefer those artifacts before falling back to HTML extraction when they are present and validated.

## Research Method

Evidence was gathered in this task using the compiled local research CLI first:

```bash
node bin/cli.mjs research <url> --format detailed --json --force
node bin/cli.mjs research <url> --rendered --format detailed --json --force
```

When the question was specifically about search backends or source Markdown availability, page metadata was inspected with network fetches to identify public search configuration, edit links, generated hash maps, and source repository links.

Evidence levels used in the site matrix:

- `verified`: observed directly in CLI output or page metadata during this task.
- `signal`: visible UI, script, repo, or metadata suggests support but endpoint/path is not proven.
- `unverified`: plausible based on public project structure, but not proven in this task.

## High-Level Conclusion

The default website-to-Markdown cache is useful but not sufficient as the only strategy.

It is sufficient for many static article pages: React reference index, Next.js docs index, Vue guide pages, Angular overview, Vite guide pages, MDN pages, Node API pages, Express pages, Prisma landing pages, and Redux Toolkit pages all produced usable Markdown through static fetch plus Readability or, for TanStack/NestJS, rendered fetch plus Readability.

It is insufficient for full Phase 2 quality because it loses or cannot infer:

- Search index access.
- Site navigation and page discovery.
- Markdown/MDX source mapping.
- Tabbed code variants.
- Code block line breaks in some Next.js/Tailwind/Docusaurus-style output.
- Landing-page noise such as image grids, footer controls, and base64 logos.
- Long-reference chunking for Node and MDN-style pages.
- Automatic fallback decisions for SPA docs such as NestJS and TanStack.

Phase 2 should therefore implement docs-engine detection, source Markdown fetchers, search connectors, stronger extraction cleanup, and automatic rendered fallback before adding many one-off parsers.

Implementation tickets must turn every `signal` or `unverified` entry into a fixture-backed `verified` fact before shipping support for that capability.
