# React

## Sources

- Docs: https://react.dev/reference/react
- Observed source links: https://github.com/facebook/react
- Search/source metadata: sampled page includes Algolia and Next.js static asset signals.

## Organization

React docs are organized into Learn and Reference areas. The sampled reference page is a hub linking to Hooks, Components, APIs, React DOM, React Compiler, ESLint plugin docs, rules, and legacy APIs.

The site is a Next.js application. The sampled page rendered enough article content in static HTML for Readability.

## Search

The sampled HTML contains Algolia-related signals and a search UI, but this task did not verify a query endpoint, app id, public key, or index name. Treat React search as a signal only until app data or chunks provide a concrete DocSearch configuration fixture.

## Markdown or Source Site

React docs are publicly sourced, but the sampled page did not expose a direct per-page GitHub edit link in the same way Vue, Vite, Next.js, and Prisma do. Source discovery should therefore use a generic Next.js/GitHub-source detector plus site-specific fallback only if required.

## Default Cache Verdict

Sufficient for individual article content. The research CLI static path returned high-confidence Markdown with clean headings and links.

Not sufficient for:

- Search discovery.
- Full page map discovery.
- Direct source Markdown/MDX provenance.
- Version/beta distinctions around compiler and server component docs.

## Recommended Work

- Use generic Next.js docs detection first.
- Add Algolia DocSearch metadata extraction only if a fixture proves the concrete config.
- Add a React source mapper only after generic source discovery fails on enough pages.
