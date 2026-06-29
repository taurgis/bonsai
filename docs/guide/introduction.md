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
pot. The tool does the same to documentation. It keeps the living structure
(headings, code, tables, lists) while trimming the bulk, so a large page fits
inside an agent's limited context window. The homepage animation makes the idea
literal: a sprawling tree of text compressing into a tidy bonsai.

## Why a cache?

Agents research the same pages over and over. Each fetch costs network time,
tokens, and nondeterminism. Bonsai fetches a page **once**, normalizes and hashes
its URL, and serves every later request from the local cache while the entry is
still fresh. Repeated research becomes a near-instant, deterministic lookup.

## Native web search vs Bonsai

CLI agents ship with built-in web search and fetch. For many questions that is
enough. Training data covers popular libraries well, and official docs for React,
TanStack, and similar stacks usually rank in search results. Our
[research workflow benchmark](/examples/agent-research-comparison) (Codex, Cursor,
Antigravity, Claude Code, 2026-06-29) showed native search often matching Bonsai on
inline answer quality for mainstream topics — sometimes at lower token cost.

The gap opens in **enterprise territory**:

- Platform documentation is thinner in training data and harder to discover.
- Vendor sites render in JavaScript, gate content behind cookie consent, or expose
  search APIs that native fetch tools never reach.
- A cheap native run can still **look** authoritative while citing mirrors,
  outdated snippets, or schema details that would fail in production.

Bonsai addresses that gap in two ways:

1. **Deterministic capture** — fetch, extract, and store the full official page as
   source-cited Markdown with freshness metadata, not a one-off summary.
2. **[Site modules](/reference/site-modules)** — custom per-host pipelines when
   the generic path is not enough (Salesforce Help and Developer are built in;
   more hosts follow as we prove the need).

Use native search for quick orientation on well-covered topics. Reach for Bonsai when
you need **verified official artifacts on disk**, shared across sessions and agents,
or when a documentation host has already failed a generic fetch.

## What it does

| Feature | How it works | Typical use case |
| --- | --- | --- |
| **Scrape and convert** | Fetches HTML, extracts the main content, sanitizes unsafe markup, and converts it to deterministic Markdown | Capturing API docs, guides, standards, and changelogs |
| **Cache-first lookup** | Normalizes URLs to collision-resistant SHA-256 keys before fetching | Avoiding duplicate network requests and repeated research |
| **Token budgeting** | Returns `compressed` or `detailed` Markdown variants | Fitting research into limited context windows without losing full detail |
| **Freshness tiers** | Supports `stable`, `standard`, `volatile`, custom TTLs, and stale revalidation | Handling standards differently from release notes or beta docs |
| **Browser fallback** | Uses `--rendered` for pages that need client-side JavaScript | Capturing SPA documentation when static HTML is incomplete |
| **[Manual import](/how-to/importing-synthesis)** | Stores agent-supplied Markdown from stdin or files | Caching synthesized notes, private docs, or manually extracted pages |
| **[List](/reference/commands#list)** | Filters cached entries by topic, tags, freshness, and metadata | Seeing what is already cached without reading full content |

## Safe by default

- Fetched HTML is treated as untrusted input.
- Only `http:` and `https:` URLs are accepted.
- Private and local IP ranges are blocked to reduce SSRF risk.
- Static extraction does not execute JavaScript; use `--rendered` when a page
  needs browser execution.
- Authenticated/private scraping is not supported in the default workflow.
  [Import](/reference/commands#import) trusted Markdown manually instead.

## Where to next

- [Getting Started](/guide/getting-started): install and fetch your first page.
- [Research workflow comparison](/examples/agent-research-comparison): when native
  web search is enough vs when Bonsai earns its cost.
- [Site modules](/reference/site-modules): custom capture for enterprise documentation hosts.
- [Caching & Freshness](/concepts/caching-and-freshness): how reuse and tiers work.
- [Compression & Token Budgeting](/concepts/compression): `compressed` vs `detailed`.
- [Importing Synthesis](/how-to/importing-synthesis): cache an agent's own research.
- [Agent Integration](/how-to/agent-integration): the JSON envelope and exit codes.
