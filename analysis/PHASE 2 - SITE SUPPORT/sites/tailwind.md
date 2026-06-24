# Tailwind CSS

## Sources

- Docs: https://tailwindcss.com/docs/installation/using-vite
- Public repo: https://github.com/tailwindlabs/tailwindcss.com and https://github.com/tailwindlabs/tailwindcss
- Observed metadata: Next.js App Router payloads, `/_next/static/`, Algolia DSN preconnect to `KNPXZI5B0M-dsn.algolia.net`.

## Organization

Tailwind docs are organized around installation, core concepts, utilities, variants, functions/directives, and framework guides. The sampled page is an installation guide with step sections and code examples.

## Search

The sampled HTML includes a custom search UI and an Algolia DSN preconnect, but this task did not verify the app id, public key, index name, or query payload. Treat this as a search signal, not supported search.

## Markdown or Source Site

The public website repository exists, but the sampled page did not expose a simple GitHub edit link or verified raw source path. Treat source discovery as a Next.js App Router source-mapping investigation, not as implemented source support.

## Default Cache Verdict

Not sufficient for exact examples. Static fetch returned readable prose, but code blocks were damaged:

- `npm create vite@latest my-projectcd my-project`
- JavaScript imports/config collapsed onto one line.
- HTML example lost line structure.

This is a P1 fidelity issue because agents copy installation snippets.

## Recommended Work

- Add Next.js App Router/RSC content extraction fixtures.
- Normalize Shiki/code block `.line` spans before Turndown.
- Inspect copy-button payloads as a possible source of exact code block text.
- Add Algolia metadata extraction from Next chunks only after a fixture captures the concrete public config.
