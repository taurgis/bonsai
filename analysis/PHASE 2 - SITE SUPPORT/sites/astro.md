# Astro

## Sources

- Docs: https://docs.astro.build/en/getting-started/
- Observed metadata: `meta generator` values for Astro and Starlight, `data-pagefind-body`, `data-pagefind-ignore`, and `sl-doc-search`.
- Public repo: https://github.com/withastro/docs

## Organization

Astro docs are built with Astro Starlight. The sampled page is a docs landing page with learn/extend paths, locale alternates, upgrade banner, and community/contributor visuals.

## Search

The page includes a Starlight search component and Pagefind body markers. It also contains DocSearch-style markup and Algolia exclusion markers. Phase 2 should detect whether the site is using Pagefind, DocSearch, or a hybrid configuration from the built assets.

## Markdown or Source Site

Astro docs are public and Starlight content is normally Markdown/MDX. The sampled page did not expose a direct edit link in the captured metadata, so source mapping should be treated as an investigation until the public repo path is fixture-proven.

## Default Cache Verdict

Partially sufficient. Static fetch returned the main landing content but included many image references from contributor/avatar grids. This is low-value noise for agents.

## Recommended Work

- Add Starlight detector.
- Strip `data-pagefind-ignore` and visual/contributor image grids before extraction.
- Prefer `data-pagefind-body` as an extraction root when present.
- Add Pagefind connector if the index is public.
