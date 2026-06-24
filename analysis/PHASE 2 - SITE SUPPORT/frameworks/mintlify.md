# Mintlify

## Sources

- Docs: https://mintlify.com/docs
- Verified `llms.txt`: https://mintlify.com/docs/llms.txt
- Tested root Markdown route: https://mintlify.com/docs.md returned 404.
- Research CLI: static fetch, low confidence, detailed token estimate about 129.
- Observed metadata: `meta name=generator content="Mintlify"`, Next.js assets under `/docs/_next/static/`, hidden agent docs index pointing to `/docs/llms.txt`.

## Organization

Mintlify is a managed documentation platform. The sampled root page is a landing/index page with heavy visual assets and generated Next.js/MDX payloads. Static Readability captured only a short marketing section and decorative images.

The page explicitly includes an AI-oriented hidden block that tells agents to fetch `/docs/llms.txt` for the complete documentation index.

## Search

Mintlify advertises smart search, and the UI has search/assistant behavior, but no public query endpoint was proven in this task.

## Markdown or Source Site

`/docs/llms.txt` is verified. The simple `/docs.md` route failed. The generic system should prefer `llms.txt` for discovery and then follow its listed URLs.

## Default Cache Verdict

Not sufficient for root pages. It may work on leaf pages, but `llms.txt` is a much better first source for agents.

## Recommended Work

- Detect Mintlify from generator meta, `/docs/_next/static/`, and `data-agent-docs-index`.
- Probe scoped `llms.txt` based on base path.
- Strip decorative Mintlify images and marketing cards from fallback HTML.
- Treat search API support as unverified until endpoint fixtures exist.
