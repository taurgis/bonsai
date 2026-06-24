# Vue

## Sources

- Docs: https://vuejs.org/guide/introduction.html
- Observed edit link: https://github.com/vuejs/docs/edit/main/src/guide/introduction.md
- Observed site data: `window.__VP_HASH_MAP__`, `window.__VP_SITE_DATA__`
- Observed search config: Algolia DocSearch with index `vuejs`, app id `ML0LEBN7FQ`, public API key in site data, and facet filter `version:v3`.

## Organization

Vue uses VitePress. The site data exposes nav and sidebar groups for Guide, API, Examples, Style Guide, glossary, translations, and ecosystem links. `__VP_HASH_MAP__` maps source Markdown paths to built asset hashes.

## Search

Public Algolia DocSearch config is present in `__VP_SITE_DATA__`. This is a high-value generic connector target because many VitePress sites use the same shape.

## Markdown or Source Site

Yes. The page exposes an edit link to a Markdown file in `vuejs/docs`. The VitePress hash map also exposes source Markdown path names for the site.

## Default Cache Verdict

Sufficient for article content. Static fetch plus Readability returned high-confidence Markdown with code examples and links.

Not sufficient for:

- Using the VitePress page map.
- Remote search.
- Direct Markdown source preference.
- Version facet handling in search.

## Recommended Work

- Implement a generic VitePress detector.
- Parse `__VP_SITE_DATA__` for nav/sidebar/search/editLink.
- Parse `__VP_HASH_MAP__` for page/source inventory.
- Implement Algolia DocSearch connector with facet filters.

