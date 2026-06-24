# MDN Web Docs

## Sources

- Docs: https://developer.mozilla.org/en-US/docs/Web/JavaScript
- Public source: https://github.com/mdn/content

## Organization

MDN organizes content by web platform area, guides, references, tutorials, and related standards. The sampled JavaScript landing page linked to beginner tutorials, guide sections, reference pages, ECMAScript specs, and contributors.

## Search

MDN has a visible site search. This task did not verify a stable public query endpoint or API contract for automated search. Phase 2 should investigate official/public endpoint stability before implementing a remote search connector.

## Markdown or Source Site

MDN content is public Markdown in `mdn/content`. URL-to-source mapping appears predictable, but it must be fixture-proven because locale, case, redirects, and path normalization can change the source path.

## Default Cache Verdict

Mostly sufficient for article content. Static fetch plus Readability returned high-confidence Markdown with useful links and headings.

Not sufficient for:

- Browser compatibility tables when exact data is needed.
- Source Markdown preference.
- Locale/source path mapping.
- Large reference page chunking.

## Recommended Work

- Add MDN source mapping.
- Add compatibility-data awareness later if agents need browser support details.
- Store MDN as `stable` or long `standard` depending on whether the page is reference/spec-like or current guide content.
