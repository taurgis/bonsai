# Next.js

## Sources

- Docs: https://nextjs.org/docs
- Observed edit link: https://github.com/vercel/next.js/edit/canary/docs/index.mdx

## Organization

The docs index states that the documentation is organized into three major sections: Getting Started, Guides, and API Reference. It also distinguishes App Router and Pages Router docs, with a sidebar dropdown for switching router contexts.

This organization matters for agents because App Router and Pages Router may provide different answers for the same topic.

## Search

The page exposes a keyboard-driven search UI. The sampled HTML did not expose a simple static local index in the first pass. Treat search as custom/hosted until the app chunks are inspected.

## Markdown or Source Site

Yes. The sampled page exposes a GitHub edit URL to `vercel/next.js` under `docs/index.mdx`. This is an ideal candidate for a generic GitHub edit-link-to-raw-source fetcher.

## Default Cache Verdict

Sufficient for page content. Static fetch plus Readability returned high-confidence Markdown.

Not sufficient for:

- Router-aware search and page discovery.
- Source MDX preference.
- App Router/Pager Router source versioning.

## Recommended Work

- Implement GitHub edit-link source mapping.
- Preserve router context in artifact metadata when URLs include `/docs/app` or `/docs/pages`.
- Search connector can be deferred until source mapping and site map extraction are in place.

