# T-21: Clean Landing Pages, Image Grids, and UI Chrome

## Goal

Improve extraction quality for docs indexes and landing pages without writing site-specific scrapers.

## Evidence

- Astro docs landing page included many contributor/avatar image links.
- TypeScript docs index included customizer text, footer content, and a base64 Microsoft logo.
- Landing pages often behave as indexes rather than article pages.

## Scope

- Strip `data-pagefind-ignore`, footer, nav, theme controls, customizers, and visually decorative image grids before Markdown conversion.
- Drop `data:` image URIs from Markdown.
- Add an `artifactType` or metadata signal for index/hub pages.
- Extract useful outgoing docs links from index pages.
- Add quality notes for high image-to-text ratio and chrome-heavy content.

## Out of Scope

- Rewriting site navigation into a full crawler.
- Removing all images from detailed article pages when images are semantically useful.

## Acceptance Criteria

- Astro sampled page no longer stores contributor/avatar image noise.
- TypeScript docs index no longer stores base64 logo data.
- Useful landing page links are preserved.
- Quality metadata indicates when a page is an index/hub.

## Validation

```bash
pnpm test -- --run src/lib/research
pnpm type-check
```

