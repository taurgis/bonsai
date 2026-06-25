# Introduction

Bonsai is a standalone **local research cache CLI for AI agents**. It turns
official documentation and web pages into source-cited Markdown artifacts,
stores them in a durable local cache, and returns deterministic output that
agents can reuse instead of repeatedly scraping the same pages.

The package is published as [`@taurgis/bonsai`](https://www.npmjs.com/package/@taurgis/bonsai)
and installs a `bonsai` binary.

::: tip Scoped package
Because the npm package is scoped, the correct one-shot command is
`npx @taurgis/bonsai ...`. The unscoped `npx bonsai` resolves to a different
package on npm.
:::

## Why the name?

A bonsai is a full tree deliberately **pruned and shaped** to thrive in a small
pot. That is exactly what this tool does to documentation: it keeps the living
structure — headings, code, tables, lists — while trimming the bulk, so a large
page fits inside an agent's limited context window. The homepage animation is
that idea made literal: a sprawling tree of text compressing into a tidy bonsai.

## Why a cache?

Agents research the same pages over and over. Each fetch costs network time,
tokens, and nondeterminism. Bonsai fetches a page **once**, normalizes and hashes
its URL, and serves every later request from the local cache while the entry is
still fresh — turning repeated research into a near-instant, deterministic
lookup.

## What it does

| Feature | How it works | Typical use case |
| --- | --- | --- |
| **Scrape and convert** | Fetches HTML, extracts the main content, sanitizes unsafe markup, and converts it to deterministic Markdown | Capturing API docs, guides, standards, and changelogs |
| **Cache-first lookup** | Normalizes URLs to collision-resistant SHA-256 keys before fetching | Avoiding duplicate network requests and repeated research |
| **Token budgeting** | Returns `compressed` or `detailed` Markdown variants | Fitting research into limited context windows without losing full detail |
| **Freshness tiers** | Supports `stable`, `standard`, `volatile`, custom TTLs, and stale revalidation | Handling standards differently from release notes or beta docs |
| **Browser fallback** | Uses `--rendered` for pages that need client-side JavaScript | Capturing SPA documentation when static HTML is incomplete |
| **Manual import** | Stores agent-supplied Markdown from stdin or files | Caching synthesized notes, private docs, or manually extracted pages |
| **Search** | Ranks local cache entries by topic, tags, snippets, fuzzy terms, and phrases | Finding existing research before fetching again |

## Safe by default

- Fetched HTML is treated as untrusted input.
- Only `http:` and `https:` URLs are accepted.
- Private and local IP ranges are blocked to reduce SSRF risk.
- Static extraction does not execute JavaScript; use `--rendered` when a page
  needs browser execution.
- Authenticated/private scraping is not supported in the default workflow —
  [import](/reference/commands#import) trusted Markdown manually instead.

## Where to next

- [Getting Started](/guide/getting-started) — install and fetch your first page.
- [Caching & Freshness](/guide/caching-and-freshness) — how reuse and tiers work.
- [Compression & Token Budgeting](/guide/compression) — `compressed` vs `detailed`.
- [Agent Integration](/guide/agent-integration) — the JSON envelope and exit codes.
