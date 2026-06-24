---
name: web-research
description: 'Bonsai-backed official documentation and web research workflow. Use before technical changes that depend on platform behavior, when fetching documentation or web pages, when searching/listing/pruning the local research cache, or when importing manually gathered notes.'
license: Forward Proprietary
compatibility: VS Code 1.x+, GitHub Copilot
metadata:
  version: '2.1.0'
---

# Web Research Skill

Use Bonsai as the cache-first research path for official documentation and web content. Prefer current official sources, keep research reusable, and avoid direct one-off web fetches when Bonsai can capture the same page.

## Required Pre-Step

Before creating, updating, refactoring, scaffolding, or deleting technical content, verify relevant current official documentation in the same task.

Search the cache first:

```bash
bonsai research search "<topic or keywords>"
```

If the cache misses or does not cover the question, fetch the source through Bonsai:

```bash
bonsai research <official-url> --format detailed
```

Inside the Bonsai repository, use the development binary:

```bash
node bin/cli.mjs research search "<topic or keywords>" --json
node bin/cli.mjs research <official-url> --format detailed --json
```

For one-shot published usage outside this repo, use the scoped package name:

```bash
npx @taurgis/bonsai research <official-url> --format detailed
```

Do not document or run bare `npx bonsai` unless an unscoped npm shim is actually published.

## Source Rules

- Prefer official vendor docs, standards, API references, SDK docs, release notes, changelogs, and security advisories.
- Include official source URLs when the change relies on platform behavior or standards.
- Use `--tier stable`, `--tier standard`, or `--tier volatile` when the source class is clear.
- Treat volatile sources as needing fresh validation before trusting them.
- Do not use the retired manual `artifacts/online-research/` protocol for new research.

## Fetch Rules

Use `--format compressed` for context-budgeted reading and `--format detailed` for exact technical details, links, tables, and code examples.

Use `--rendered` when static extraction is incomplete or the page is an SPA:

```bash
bonsai research <official-url> --rendered --format detailed
```

Never reach for direct `WebFetch` or `WebSearch` to retrieve a specific page when Bonsai can fetch it. Bonsai returns reusable Markdown and keeps it cached for future agents.

Pure discovery searches are allowed when you do not yet know which URL to fetch. Once a URL is selected, capture it with Bonsai.

## Manual Fallbacks

If direct web access was unavoidable because of authentication, browser interaction, or a tool constraint, import the result into Bonsai before returning.

Single-source import:

```bash
bonsai research import <url> --file path/to/notes.md
```

Stdin import:

```bash
echo "# My Synthesis Note" | bonsai research import <url> --stdin
```

Multi-source synthesis:

```bash
bonsai research import \
  --topic "<descriptive topic>" \
  --source-url <url1> \
  --source-url <url2> \
  --file path/to/synthesized-notes.md
```

## Cache Operations

Check status without fetching:

```bash
bonsai research status <url>
```

Inspect stored metadata:

```bash
bonsai research inspect <url>
```

List or search cached entries:

```bash
bonsai research list --tags node
bonsai research search "react suspense"
```

Preview pruning before deleting:

```bash
bonsai research prune --older-than 90d --dry-run
bonsai research prune --older-than 90d --yes
```

## When This Does Not Apply

- No technical content or web content is involved.
- You already fetched and applied current official docs in the current task.
- The request is a trivial typo or formatting fix that does not involve platform behavior.
- Bonsai is not installed and `npx @taurgis/bonsai ...` is not available; use the best available official-source workflow and import notes later.
