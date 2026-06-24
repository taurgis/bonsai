# Redux Toolkit

## Sources

- Docs: https://redux-toolkit.js.org/introduction/getting-started
- Public repo: https://github.com/reduxjs/redux-toolkit

## Organization

Redux Toolkit uses a Docusaurus-style docs site. Content is organized by introduction, tutorials, API reference, RTK Query, usage guides, and ecosystem resources.

## Search

Docusaurus sites commonly expose local route/sidebar metadata and may use local or Algolia search plugins. The sampled task did not confirm the exact provider, so implement a generic Docusaurus detector first.

## Markdown or Source Site

Redux Toolkit docs are public source content in the project ecosystem, but this task did not verify a sampled edit URL or raw source mapping. Direct source mapping should be proven from Docusaurus edit metadata or route data before being marked supported.

## Default Cache Verdict

Partially sufficient. Static fetch returned high-confidence Markdown, but some code examples collapsed adjacent commands and imports. Prose, tables, and headings were otherwise useful.

## Recommended Work

- Add Docusaurus detector.
- Normalize highlighted code block line spans.
- Prefer source Markdown/MDX when edit/source metadata is available.
- Use Redux Toolkit as the first Docusaurus fixture.
