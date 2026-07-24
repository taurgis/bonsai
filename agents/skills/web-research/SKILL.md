---
name: web-research
description: 'Bonsai-backed official documentation and web research workflow. Use before technical changes that depend on platform behavior, when fetching documentation or web pages, when listing/searching/pruning the local research cache, or when importing manually gathered notes.'
license: Forward Proprietary
compatibility: VS Code 1.x+, GitHub Copilot
metadata:
  version: '3.5.0'
---

# Web Research Skill

Use Bonsai as the cache-first research path for official documentation and web content. Prefer current official sources, keep research reusable, and avoid direct one-off web fetches when Bonsai can capture the same page.

## Invocation

Always run Bonsai through the published npm package:

```bash
npx @taurgis/bonsai <command> [flags]
```

Default to `--toon` for structured output — the same envelope as `--json`, at a lower token cost — as every example below does. Reach for `--json` only when a caller specifically needs real JSON (mutually exclusive with `--toon`).

If you are operating under a read-only/plan-mode harness, add `--read-only` (alias `--plan`) to every Bonsai call, or export `BONSAI_READ_ONLY=1` (or `BONSAI_PLAN_MODE=1`) once for the session. Fetches still run and return content normally; nothing is written to the local cache or config until the harness leaves plan mode. `import`, `config set`/`unset`, and `prune` all honor it too — see "Read-only / Plan Mode" below.

## Required Pre-Step

Before creating, updating, refactoring, scaffolding, or deleting technical content, verify relevant current official documentation in the same task.

When you do not yet know the official URL, discover it with your native web/search tools first. Once you have a URL, capture it through Bonsai:

```bash
npx @taurgis/bonsai <official-url> --format detailed --toon
```

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
npx @taurgis/bonsai <official-url> --rendered --format detailed --toon
```

Never reach for direct `WebFetch` or `WebSearch` to retrieve a specific page when Bonsai can fetch it. Bonsai returns reusable Markdown and keeps it cached for future agents.

## Manual Fallbacks

If direct web access was unavoidable because of authentication, browser interaction, or a tool constraint, import the result into Bonsai before returning.

Single-source import:

```bash
npx @taurgis/bonsai import <url> --file path/to/notes.md --toon
```

Stdin import:

```bash
echo "# My Synthesis Note" | npx @taurgis/bonsai import <url> --stdin --toon
```

Multi-source synthesis:

```bash
npx @taurgis/bonsai import \
  --topic "<descriptive topic>" \
  --source-url <url1> \
  --source-url <url2> \
  --file path/to/synthesized-notes.md \
  --toon
```

## Cache Operations

Check status without fetching:

```bash
npx @taurgis/bonsai status <url> --toon
```

Inspect stored metadata:

```bash
npx @taurgis/bonsai inspect <url> --toon
```

List cached entries by metadata. Prefer `--toon` for agent callers — same data as `--json`, fewer
tokens:

```bash
npx @taurgis/bonsai list --tags node --toon
```

Search cached entries by tag or content keyword when you don't know the exact topic/tag to filter
on — ranks page-level entries by a query matched against topic, tags, summary, and compressed
content:

```bash
npx @taurgis/bonsai search --query "suspense boundary" --toon
```

Both default `--limit` to 10 so a broad query never floods your context. A truncated result's
envelope carries `summary.truncated` and `summary.nextCommand` — a ready-to-run command that
reproduces your filters with a raised `--limit` — so raise it deliberately only when you actually
need more, instead of requesting a large `--limit` up front.

Preview pruning before deleting:

```bash
npx @taurgis/bonsai prune --older-than 90d --dry-run --toon
npx @taurgis/bonsai prune --older-than 90d --yes --toon
```

## Read-only / Plan Mode

Bonsai supports a global `--read-only` flag (alias `--plan`), also honored via the `BONSAI_READ_ONLY`/`BONSAI_PLAN_MODE` environment variables, that blocks all filesystem writes and deletes (cache persistence, config writes, `prune` deletions) while still allowing network fetches to run:

- Research fetches still hit the network and return content normally; they just skip writing the result to the local cache.
- `import` previews the write and reports `dryRun: true` instead of persisting.
- `prune` treats `--read-only` like an implicit dry run; combining it with `--yes` is rejected.

Composition is OR: once read-only mode is active (flag or either env var), there is no per-call way to force writes back on. Use this whenever the calling agent itself is confined to a read-only/plan mode, so research stays possible without violating that constraint.

## When This Does Not Apply

- No technical content or web content is involved.
- You already fetched and applied current official docs in the current task.
- The request is a trivial typo or formatting fix that does not involve platform behavior.
- `npx @taurgis/bonsai` is unavailable in the environment; use the best available official-source workflow and import notes later.
