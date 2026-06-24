# Starlight

## Sources

- Docs: https://starlight.astro.build/getting-started/
- Observed edit link: https://github.com/withastro/starlight/edit/main/docs/src/content/docs/getting-started.mdx
- Research CLI: static fetch, high confidence, detailed token estimate about 836.
- Observed metadata: Astro and Starlight generator meta tags, `data-pagefind-ignore`, tabbed code DOM, `data-pagefind` text markers.

## Organization

Starlight is an Astro documentation theme. It produces static HTML with rich semantic content and Starlight-specific components:

- Sidebars and page layout are server-rendered.
- Tabs render multiple package-manager variants in the DOM.
- Code blocks use Expressive Code markup with copy-button payloads.
- Edit links can map pages back to `src/content/docs/*.mdx`.

## Search

Starlight sites commonly use Pagefind or a Starlight search component. The sampled page exposed Pagefind-related markers, but a public Pagefind index URL was not proven in this task. Treat Pagefind as `signal` until the index files are fetched in fixtures.

## Markdown or Source Site

Yes when edit links are enabled. The sampled page exposed a GitHub edit link to MDX source. Generic support can convert this to raw GitHub content after validating branch and path.

## Default Cache Verdict

Mostly sufficient for article text, but partial for exact technical use. The default cache missed or flattened some tabbed command variants and should preserve Starlight tab groups as structured alternatives.

## Recommended Work

- Detect Starlight from generator meta and Starlight DOM markers.
- Strip `data-pagefind-ignore` and theme controls before Readability.
- Preserve `starlight-tabs` groups and Expressive Code line breaks.
- Verify Pagefind index discovery separately.
