---
description: Prefer the forward-nexus research CLI for all online research;
  store any direct web fetches back into the cache.
applyTo: "**"
metadata:
  version: 1.0.0
---

# Web Research Workflow

## Mandatory Pre-Step

Before fetching any URL or running a web search:

1. **Search the local cache first** — avoid redundant network calls:
   ```bash
   forward-nexus research search "<topic or keywords>"
   ```
2. **Fetch through the CLI if the cache misses** — the CLI handles caching, freshness tiers, HTML-to-Markdown conversion, and token budgeting automatically:
   ```bash
   forward-nexus research <url>
   ```

Never reach for `WebFetch` or `WebSearch` to retrieve a specific page when the CLI can do it — the CLI returns the same content and keeps it cached for all future sessions.

## If You Fetched a Page Directly

When a direct `WebFetch` or `WebSearch` was unavoidable (e.g. authentication-gated content, SPA requiring interaction, or a tool constraint), import the result into the cache so subsequent agents can reuse it:

```bash
# Pipe fetched content into the cache under its source URL
echo "<fetched markdown content>" | forward-nexus research import <url> --stdin

# Multi-source synthesis
forward-nexus research import \
  --topic "<descriptive topic>" \
  --source-url <url1> \
  --source-url <url2> \
  --file path/to/synthesized-notes.md
```

## When This Does Not Apply

- The `forward-nexus-plugin-research` plugin is not installed (`forward-nexus plugins install forward-nexus-plugin-research`).
- The target is behind authentication or requires browser interaction that the CLI cannot handle — use `--rendered` first before falling back to direct fetch.
- Pure discovery searches (finding which URLs exist) where no specific page content is being retrieved.
- The request is conversational and requires no web content at all.
