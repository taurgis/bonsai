---
layout: home

hero:
  name: Bonsai
  text: Prune docs to fit the context window.
  tagline: A local research cache for AI agents — fetch a page once, compress it to a token budget, and reuse it instead of scraping the same page again.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Why Bonsai?
      link: /guide/introduction
    - theme: alt
      text: View on GitHub
      link: https://github.com/taurgis/bonsai

features:
  - icon: 🌿
    title: Freshness tiers
    details: stable, standard, and volatile policies plus custom TTLs. Stale entries are revalidated with cheap conditional requests before any full refetch.
    link: /guide/caching-and-freshness
    linkText: How caching works
  - icon: ✂️
    title: Token budgeting
    details: Every page is stored as a compressed and a detailed variant. Compression prunes prose while always keeping headings, code, tables, and lists.
    link: /guide/compression
    linkText: Compression deep-dive
  - icon: 🔁
    title: Cache-first by design
    details: URLs are normalized and hashed to collision-resistant SHA-256 keys, so slightly different URLs hit the same entry and reuse is instant.
    link: /reference/cache-protocol
    linkText: Cache protocol
  - icon: 🤖
    title: Agent-native output
    details: A stable JSON envelope and deterministic exit codes let AI agents and scripts handle hits, misses, and stale content programmatically.
    link: /guide/agent-integration
    linkText: Agent integration
  - icon: 🛡️
    title: Safe by default
    details: Only http(s) URLs, an SSRF blocklist for private IP ranges, untrusted-HTML handling, and secrets kept out of the committable project cache.
    link: /troubleshooting
    linkText: Limits & safety
  - icon: 📥
    title: Manual import
    details: Cache agent-synthesized notes or private docs straight from stdin or a file, with the same metadata, search, and freshness rules.
    link: /reference/commands
    linkText: Command reference
---

## From a sprawling page to a tidy bonsai

The hero above shows the whole idea in motion: a verbose page, rendered as text,
then **pruned and compressed** to the essential shape that fits an agent's
context window. The structure that matters stays intact.

```bash
# Fetch, extract, convert to Markdown, and cache — one command
npx @taurgis/bonsai https://nodejs.org/api/url.html

# Run it again — served straight from the local cache while fresh
npx @taurgis/bonsai https://nodejs.org/api/url.html
```

Bonsai requires **Node.js 22 or newer** and is published as
[`@taurgis/bonsai`](https://www.npmjs.com/package/@taurgis/bonsai). Head to
[Getting Started](/guide/getting-started) to fetch your first page, or read
[Why Bonsai?](/guide/introduction) for the reasoning behind the cache.
