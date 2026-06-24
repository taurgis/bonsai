---
name: web-research
description: 'Searches, crawls, and manages the local research cache for any web content using the forward-nexus research plugin. Use when asked to research a technical topic, fetch documentation or web pages, list or search local cache contents, import custom notes, or prune expired research.'
license: Forward Proprietary
compatibility: VS Code 1.x+, GitHub Copilot
metadata:
  version: '2.0.0'
---

# Web Research Skill

This skill guides agents on how to search, scrape, import, and prune web research cache entries using the `research` plugin for the `forward-nexus` CLI.

---

## When to Use This Skill

* Before making any technical or architectural changes, to verify platform specs, API documentation, or any authoritative web source.
* To check if target content is already cached locally.
* To crawl public HTTP/HTTPS pages and convert them to clean Markdown.
* To import custom synthesized notes or Markdown files.
* To prune old/expired entries from the local research cache.

---

## How to Use

### Installation

`forward-nexus-plugin-research` is a plugin for the published `forward-nexus` CLI. Install the plugin once:
```bash
forward-nexus plugins install forward-nexus-plugin-research
```

After installation, all `research` subcommands are available under the host CLI:
```bash
forward-nexus research <url>
```

> **Developer mode** (running inside this plugin repo directly):
> ```bash
> node bin/cli.mjs research <url>
> ```

---

## Cache Retrieval Workflows

### Step 1: Search the cache first (SSOT)
Always search for existing records before starting a network crawl to save time and prevent duplicates:
```bash
forward-nexus research search "node url"
```

### Step 2: Fetch and crawl if missing
If search returns no results, perform a fetch. By default, it will crawl the URL, strip boilerplate, convert it to clean Markdown, and write it to the cache:
```bash
forward-nexus research https://nodejs.org/api/url.html
```

#### Output Density Control:
* **Compressed (Default)**: Best for tight LLM context windows (strips images, extra attributes, raw formatting):
  ```bash
  forward-nexus research https://nodejs.org/api/url.html --format compressed
  ```
* **Detailed**: Retains full detailed markup, code snippets, tables, and absolute links:
  ```bash
  forward-nexus research https://nodejs.org/api/url.html --format detailed
  ```

### Step 3: Use `--rendered` for SPA / client-side JS pages
If the static fetch returns empty content or loading indicators, the page likely requires JavaScript execution. Use `--rendered` to launch headless Chrome via CDP:
```bash
forward-nexus research https://react.dev/reference/react --rendered
```
Requirements:
* Chrome or Chromium installed locally (or set `CHROME_PATH`).
* Node.js 22+ (native `WebSocket` support).
* No additional npm dependencies needed.

---

## Managing cache metadata

### List cached items
List cached entries with flexible metadata filters:
```bash
# List all node-related entries
forward-nexus research list --tags node

# List only volatile entries
forward-nexus research list --freshness fresh --topic volatile
```

### Check status or inspect metadata
See if a URL would cache hit or miss without performing a download:
```bash
forward-nexus research status https://nodejs.org/api/url.html
```
To print the full parsed YAML frontmatter:
```bash
forward-nexus research inspect https://nodejs.org/api/url.html
```

### Advanced full-text search
`research search` supports fuzzy matching (Levenshtein distance ≤ 2 for terms ≥ 4 chars), term frequency ranking, substring matching in topics/tags, and exact phrase match bonuses:
```bash
forward-nexus research search "react suspnse"   # finds "react suspense" via fuzzy match
forward-nexus research search "nestjs config"    # phrase match ranks topic "Custom NestJS Config" higher
```

---

## Storing and Pruning Cache Notes

### Import Custom Research Notes
If scraping a client-side JS app (SPA) yields empty output, or if you want to save a multi-source research synthesis, use the `import` command:
* **Stdin Import**:
  ```bash
  echo "# My Synthesis Note" | forward-nexus research import https://example.com/single --stdin
  ```
* **File Import**:
  ```bash
  forward-nexus research import --topic "React Suspense Guide" --source-url https://react.dev/a --source-url https://react.dev/b --file path/to/my-notes.md
  ```

### Pruning Expired Cache Files
Prune stale files based on age, inactivity, or type. Always perform a `--dry-run` first to preview the changes safely:
```bash
# Dry Run check
forward-nexus research prune --older-than 90d --dry-run

# Actual delete
forward-nexus research prune --older-than 90d --yes
```

---

## Troubleshooting

### Issue: Plugin commands not found
* **Cause**: Plugin not yet installed in the `forward-nexus` CLI.
* **Solution**: Install it first:
  ```bash
  forward-nexus plugins install forward-nexus-plugin-research
  ```

### Issue: Fetch throws hostname safety error
* **Cause**: Target host resolved to a private or local IP block (SSRF protection blocking RFC1918/localhost).
* **Solution**: You cannot automatically scrape private networks. Export the target page manually to Markdown and import it:
  ```bash
  forward-nexus research import http://localhost:8080/docs --file path/to/local-notes.md
  ```

### Issue: Scraped Markdown is empty or contains only loading indicators
* **Cause**: The target page is a Single-Page Application (SPA) relying entirely on client-side JS.
* **Solution**: Re-run with `--rendered` to use browser-rendered extraction:
  ```bash
  forward-nexus research https://spa-docs.example.com --rendered
  ```
  If Chrome is not available, open the page in a browser, copy the main text, and import it using the `--file` or `--stdin` flags.
