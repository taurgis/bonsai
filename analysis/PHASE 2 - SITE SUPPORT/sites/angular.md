# Angular

## Sources

- Docs: https://angular.dev/overview
- Public repo: https://github.com/angular/angular
- Observed metadata: Angular docs app references `adev` and `docs-content` assets in sampled HTML.

## Organization

Angular documentation is served from `angular.dev` and includes overview, tutorials, guides, API reference, roadmap, and playground paths. The sampled overview page is an article-like entry point and extracted cleanly.

## Search

Search appears custom to the Angular docs app, with generated docs-content asset signals. Do not assume Algolia or a public API. Phase 2 should inspect the app's docs-content/search bundle and model it as a generated-index connector only if fixtures prove it is public and stable.

## Markdown or Source Site

Likely yes through the Angular repo's `adev` documentation source, but the sampled page did not expose a direct edit link. Source mapping should be treated as a custom generated-docs source mapper unless a generic GitHub link is found on deeper pages.

## Default Cache Verdict

Sufficient for sampled overview article content. Static fetch plus Readability returned high-confidence Markdown.

Partial for API/reference workflows because agents need search/page discovery and may need symbol-level API lookup.

## Recommended Work

- Add Angular to the generated-static/custom docs investigation ticket.
- Prefer generic generated-index handling over a hand-written parser.
- Add fixtures for overview and API reference pages before deciding whether Angular needs a dedicated module.
