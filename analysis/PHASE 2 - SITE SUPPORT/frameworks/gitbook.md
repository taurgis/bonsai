# GitBook

## Sources

- Docs: https://docs.gitbook.com/
- Verified `llms.txt`: https://gitbook.com/docs/llms.txt
- Verified page Markdown: https://gitbook.com/docs/getting-started/readme.md
- Research CLI: static fetch, medium confidence, detailed token estimate about 995.

## Organization

GitBook is a managed documentation platform. The sampled page exposes multiple AI/source-friendly hints directly in the extracted content:

- Complete documentation index via `llms.txt`.
- Current page available as Markdown.
- Docs-as-code Git sync content.

The HTML extraction included a useful index but also repeated large cover images.

## Search

Search UI exists, but the public search API was not proven. Use `llms.txt` and Markdown routes for discovery before attempting search.

## Markdown or Source Site

Verified. GitBook provides both `llms.txt` and per-page Markdown routes.

## Default Cache Verdict

Partial. Article/index text is extractable, but the Markdown route is cleaner and should be preferred. HTML fallback needs image cleanup.

## Recommended Work

- Detect GitBook by `llms.txt`, `.md` links, GitBook image proxy URLs, and platform metadata.
- Prefer page Markdown when linked.
- Store `llms.txt` as a site index artifact.
- Drop repeated cover images from fallback HTML extraction.
