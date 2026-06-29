# Getting Started

This is a first run from an empty cache. By the end you will have fetched a page,
served it again from the local cache with no network call, inspected what got
stored, and listed what got cached. Five commands, a few minutes, no
configuration.

We use the Node.js URL docs throughout because they are public, stable, and
small enough to read in full.

## Requirements

Bonsai requires **Node.js 22 or newer**. Check with `node --version`.

## Install

Run it without installing anything globally:

```bash
npx @taurgis/bonsai https://nodejs.org/api/url.html
```

Install it as a normal CLI:

```bash
npm install -g @taurgis/bonsai
bonsai https://nodejs.org/api/url.html
```

Or use the local development binary from inside the repository:

```bash
pnpm install
pnpm build
node bin/cli.mjs --help
```

::: tip Use the scoped name
The package is scoped, so the one-shot command is `npx @taurgis/bonsai …`.
Plain `npx bonsai` resolves to a different, unrelated package.
:::

## 1. Fetch and cache a page

```bash
npx @taurgis/bonsai https://nodejs.org/api/url.html
```

The first run fetches the page, extracts the main article, converts it to
Markdown, estimates its token size, and writes it to the cache. What prints is
the cleaned Markdown itself — the compressed variant, ready to drop into a
context window:

```
# URL

The `node:url` module provides utilities for URL resolution and parsing...

## URL strings and URL objects
...
```

That output is the whole point: a large HTML page reduced to the structure that
matters, with the headings, code, and tables intact.

## 2. Run it again — straight from cache

Run the exact same command a second time:

```bash
npx @taurgis/bonsai https://nodejs.org/api/url.html
```

The output is identical, but this run made **no network request**. While the
entry is fresh, Bonsai serves the stored copy. That is the difference between
re-scraping a page and reusing it. [Caching & Freshness](/concepts/caching-and-freshness)
explains how "fresh" is decided.

## 3. See what's cached, without fetching

`status` reports what a fetch *would* do, and touches nothing:

```bash
npx @taurgis/bonsai status https://nodejs.org/api/url.html
```

```
URL: https://nodejs.org/api/url.html
Cache Key: 7f3a…c9e1
Cache Path: ~/.local/share/bonsai/research/7f3a…c9e1.md
Status: hit
Freshness: fresh
Action: would_return_cached
```

`Action: would_return_cached` confirms the next fetch is a free cache read. Use
`inspect` to see the full stored metadata (tier, tags, timestamps, capture
method):

```bash
npx @taurgis/bonsai inspect https://nodejs.org/api/url.html
```

## 4. Import a note of your own

Not everything comes from a fetch. Pipe in your own Markdown and Bonsai caches it
under the same rules:

```bash
echo "# Node URL API: field notes" | \
  npx @taurgis/bonsai import https://nodejs.org/api/url.html --stdin
```

Because the key matches the page's URL, a later fetch of that URL serves your
note. To store a synthesis drawn from several pages, give it a topic and list its
sources:

```bash
echo "# Synthesized React data-fetching guide" | npx @taurgis/bonsai import --stdin \
  --topic "React data fetching" \
  --source-url https://react.dev/reference/react/useEffect \
  --source-url https://tanstack.com/query/latest
```

See [Import synthesized research](/how-to/importing-synthesis) for the difference
between the two shapes.

## 5. List what you have cached

Listing is the quickest way to see prior research without reading full content:

```bash
npx @taurgis/bonsai list --url "https://nodejs.org/*"
```

You now have the full loop: fetch once, reuse for free, import your own notes,
and browse cached entries by metadata.

## What's next

- **Understand the model:** [Caching & Freshness](/concepts/caching-and-freshness)
  and [Compression & Token Budgeting](/concepts/compression).
- **Do a specific task:** [Share your cache with a team](/how-to/share-cache-with-your-team)
  or [Cache pages you can't fetch](/how-to/cache-pages-you-cant-fetch).
- **Look it up:** the [Command Reference](/reference/commands) lists every flag
  and JSON schema, and the [Glossary](/reference/glossary) defines the terms used
  across these docs.
