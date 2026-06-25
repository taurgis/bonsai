# Getting Started

## Requirements

Bonsai requires **Node.js 22 or newer**.

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

Use the local development binary from inside the repository:

```bash
pnpm install
pnpm build
node bin/cli.mjs --help
```

## Quick start

### 1. Fetch and cache a URL

```bash
npx @taurgis/bonsai https://nodejs.org/api/url.html
```

The first run fetches the page, extracts the main article content, converts it
to Markdown, estimates token size, and stores it locally.

### 2. Reuse the cache

```bash
npx @taurgis/bonsai https://nodejs.org/api/url.html
```

The second run returns from cache while the entry is still fresh, with no network
request needed. See [Caching & Freshness](/guide/caching-and-freshness) for how
"fresh" is decided.

### 3. Check cache state and metadata

```bash
npx @taurgis/bonsai status https://nodejs.org/api/url.html
npx @taurgis/bonsai inspect https://nodejs.org/api/url.html
```

`status` reports what *would* happen without fetching; `inspect` prints the
stored frontmatter metadata.

### 4. Import manual research notes

```bash
echo "# My Custom Node API Notes" | npx @taurgis/bonsai import https://nodejs.org/api/url.html --stdin

echo "# Synthesized React Cache Guide" | npx @taurgis/bonsai import --stdin \
  --topic "React Suspense" \
  --source-url https://react.dev/a \
  --source-url https://react.dev/b
```

Use [`import`](/guide/importing-synthesis) for agent-synthesized notes, private
docs, or pages that the static fetcher cannot read.

### 5. Search before fetching

```bash
npx @taurgis/bonsai search "node api url"
```

Searching the local cache first is the cheapest way to reuse prior research. See
[Search](/guide/search) for ranking, filters, and live site discovery.

## Next steps

- [Compression & Token Budgeting](/guide/compression): choose `compressed` vs `detailed`.
- [Storage Modes](/guide/storage-modes): global vs project caches.
- [Command Reference](/reference/commands): every flag and JSON schema.
