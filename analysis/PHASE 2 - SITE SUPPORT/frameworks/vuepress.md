# VuePress

## Sources

- Docs: https://vuepress.vuejs.org/guide/introduction.html
- Research CLI: static fetch, high confidence, detailed token estimate about 749.

## Organization

VuePress is a Markdown-centered static site generator. It creates a Vue SPA with server-rendered/static HTML for routes. The sampled page clearly explains the Markdown-to-route model and generated static HTML.

## Search

VuePress search support is plugin/theme dependent. No public search endpoint was proven from the sampled page.

## Markdown or Source Site

Markdown source is the authoring model, but a direct edit/source URL was not proven in this task.

## Default Cache Verdict

Sufficient for article text. Not sufficient for page discovery or source preference.

## Recommended Work

- Treat VuePress as a legacy Vue docs-engine detector after VitePress.
- Support source mapping only when edit links or site data prove it.
- Prefer generic static extraction for leaf pages.
