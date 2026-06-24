# Rspress

## Sources

- Docs: https://rspress.dev/guide/start/introduction
- Verified `llms.txt`: https://rspress.dev/llms.txt redirects to https://rspress.rs/llms.txt
- Verified route Markdown: https://rspress.dev/guide/start/introduction.md redirects to https://rspress.rs/guide/start/introduction.md
- Research CLI: static fetch, high confidence, detailed token estimate about 4777.

## Organization

Rspress is a React/Rsbuild static site generator. The sampled page is rich and long, with MDX, Shiki code blocks, multi-version docs, full-text search, and SSG-MD support.

The docs explicitly describe SSG-MD: generated Markdown files, `llms.txt`, and `llms-full.txt`.

## Search

Rspress documents built-in full-text search based on FlexSearch, but the concrete public index URL was not proven in this task.

## Markdown or Source Site

Verified. Both `llms.txt` and route-level `.md` are available. Rspress is the clearest evidence that generic support should probe Markdown routes and LLM indexes before HTML extraction.

## Default Cache Verdict

Sufficient for article body but not optimal. The HTML page is long and includes repeated interactive examples; route Markdown should be preferred.

## Recommended Work

- Detect Rspress from page metadata/classes and successful route `.md`.
- Prefer `.md` route for detailed content.
- Store `llms.txt` and optionally `llms-full.txt` as site index artifacts.
- Add Shiki line-preservation fixtures.
