---
layout: home

hero:
  name: Bonsai
  text: Better grounding for the tokens you spend.
  tagline: We ran the same research prompts in Codex, Cursor, Antigravity, and Claude Code with native web search and with Bonsai. Bonsai often costs more per session — but leaves official pages on disk, scores higher on accuracy, and reuses cleanly. Popular library docs worked either way; client-rendered enterprise portals usually did not.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: brand
      text: SFCC benchmark scenario
      link: /examples/agent-research-comparison#scenario-2-salesforce-b2c-commerce-chunk-oriented-job-step
    - theme: alt
      text: Why Bonsai?
      link: /guide/introduction

features:
  - icon: 🌿
    title: Freshness tiers
    details: stable, standard, and volatile policies plus custom TTLs. Stale entries are revalidated with cheap conditional requests before any full refetch.
    link: /concepts/caching-and-freshness
    linkText: How caching works
  - icon: ✂️
    title: Token budgeting
    details: Every page is stored as a compressed and a detailed variant. Compression prunes prose while always keeping headings, code, tables, and lists.
    link: /concepts/compression
    linkText: Compression deep-dive
  - icon: 🔁
    title: Cache-first by design
    details: URLs are normalized and hashed to collision-resistant SHA-256 keys, so slightly different URLs hit the same entry and reuse is instant.
    link: /reference/cache-protocol
    linkText: Cache protocol
  - icon: 🤖
    title: Agent-native output
    details: A stable JSON envelope and deterministic exit codes let AI agents and scripts handle hits, misses, and stale content programmatically.
    link: /how-to/agent-integration
    linkText: Agent integration
  - icon: 🛡️
    title: Safe by default
    details: Only http(s) URLs, an SSRF blocklist for private IP ranges, untrusted-HTML handling, and secrets kept out of the committable project cache.
    link: /troubleshooting
    linkText: Limits & safety
  - icon: 📥
    title: Manual import
    details: Cache agent-synthesized notes or private docs straight from stdin or a file, with the same metadata, listing, and freshness rules.
    link: /reference/commands
    linkText: Command reference
  - icon: 🏢
    title: Enterprise docs, handled
    details: Site modules add custom fetch and extraction when generic agents hit JavaScript-rendered docs, unstable URLs, or gated vendor portals. Salesforce ships as a reference example.
    link: /reference/site-modules
    linkText: Site modules
---

## When native web search is enough — and when it is not

We ran three research prompts twice in **Codex**, **Cursor**, **Antigravity**, and **Claude Code**: native web search, then the Bonsai workflow.

On TanStack Query and React Server Components, native search plus training data often produced inline answers close to Bonsai. In Cursor's TanStack run, native WebFetch matched Bonsai's depth at **31k vs 47k tokens**. Nothing from that native run landed on disk for the next session.

Enterprise and vendor documentation was different. Our benchmark used a [Salesforce B2C Commerce](/examples/agent-research-comparison#scenario-2-salesforce-b2c-commerce-chunk-oriented-job-step) job-step prompt as the hard case; the same failure modes appear on other client-rendered portals. Codex spent ~80k tokens and produced no usable answer. Claude and Antigravity wrote confident guides with subtle schema mistakes. These hosts render in the browser, gate content behind cookie consent, and rewrite URLs when products rebrand. A generic fetch often gets an empty shell or a search snippet, not the article you meant to cite.

That is what **[site modules](/reference/site-modules)** are for: host-specific fetch and extraction when the generic pipeline fails. Salesforce Help and Developer ship as a reference implementation; the same pattern covers any SPA-heavy docs site.

Reach for Bonsai when you need **grounding and reuse per token spent**, not the lowest meter on the first pass. Full benchmark: [research workflow comparison](/examples/agent-research-comparison) — the [enterprise SFCC scenario](/examples/agent-research-comparison#scenario-2-salesforce-b2c-commerce-chunk-oriented-job-step) is the clearest split.

## From a sprawling page to a tidy bonsai

The hero animation uses Codex's [enterprise SFCC prompt](/examples/agent-research-comparison#scenario-2-salesforce-b2c-commerce-chunk-oriented-job-step) from the [research benchmark](/examples/agent-research-comparison): **~80k** native tokens, no usable answer, versus **~74k** with Bonsai and official pages on disk. Grounding climbs from **no capture** to **100%** as the tree compresses — same order of spend, very different outcome.

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
