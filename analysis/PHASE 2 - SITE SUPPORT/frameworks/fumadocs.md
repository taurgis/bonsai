# Fumadocs

## Sources

- Docs: https://fumadocs.dev/docs
- Verified `llms.txt`: https://fumadocs.dev/llms.txt
- Tested root Markdown route: https://fumadocs.dev/docs.md returned 404.
- Research CLI: static fetch, medium confidence, detailed token estimate about 547.

## Organization

Fumadocs is a React documentation framework that can compose into frameworks such as Next.js. The sampled page is a Next.js App Router page with Fumadocs layout classes, sidebar links, and compiled code blocks in flight payloads.

Fumadocs documentation advertises LLM integration, and the site exposes a public `llms.txt` index.

## Search

Search UI is present, but the endpoint or search index was not proven. Treat as `signal`.

## Markdown or Source Site

`llms.txt` is verified. The simple root `.md` route tested in this task returned 404, so Fumadocs support should start from `llms.txt` and framework metadata rather than assuming every route has a `.md` sibling.

## Default Cache Verdict

Partial. Readability extracted useful content, but RSC payloads include richer code block/source structure, and `llms.txt` should be preferred for discovery.

## Recommended Work

- Detect Fumadocs markers and `llms.txt`.
- Parse `llms.txt` as a discovery artifact.
- Add fixtures for Fumadocs code block line preservation from RSC/HTML.
- Do not assume `.md` route support unless the site proves it.
