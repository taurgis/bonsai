# TanStack Query

## Sources

- Docs: https://tanstack.com/query/v5/docs/react/overview
- Public repo: https://github.com/TanStack/query

## Organization

TanStack Query docs are organized by version, framework adapter, guides, API reference, examples, and package areas. URL paths include version and adapter context, such as `/query/v5/docs/react/...`.

## Search

Search appears custom/local. Public endpoint status was not confirmed in this task, so keep search out of scope until a fixture proves the index or API shape.

## Markdown or Source Site

Likely yes in the TanStack Query repository docs. Source mapping should account for version and framework adapter.

## Default Cache Verdict

Not sufficient without rendered fallback. The existing site module already defaults TanStack to rendered extraction. Rendered extraction returned high-confidence Markdown.

Remaining issues:

- Source comments such as `[//]: # 'Example'` leaked into Markdown.
- Search and page discovery are not covered.
- Version/framework context must be preserved.

## Recommended Work

- Keep rendered default.
- Strip Markdown comment artifacts after conversion.
- Add source mapping and version/framework metadata.
- Add search/page map investigation after generic engine work.
