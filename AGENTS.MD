# Agent Instructions

This repository builds Bonsai, a standalone oclif CLI published as `@taurgis/bonsai` with a `bonsai` binary. Bonsai turns the manual docs research workflow into reusable local research cache commands for agents.

## Read first

Before changing technical content or implementation code, read:

1. `.agents/rules/web-research.md` for the existing repo-wide research requirement.
2. `.github/agents/official-docs-researcher.agent.md` for the Bonsai-backed official docs workflow.

If a change depends on platform behavior, verify current official documentation in the same task. Do not rely only on model memory for oclif, Readability, Turndown, Node.js, or browser behavior.

## Project intent

Build a CLI that lets agents do research through a stable local cache instead of repeating manual web research. Preserve the useful parts of the current subagent protocol:

- official-source bias
- source-cited synthesized notes
- cache-first lookup
- freshness tiers
- cheap stale revalidation
- frontmatter as durable metadata
- deterministic machine-readable output

The CLI should make the protocol executable, testable, and reusable across repositories.

Development of Bonsai happens in this repository. Keep Bonsai implementation in this package instead of adding it to another CLI as a core command.

## CLI design rules

- Use oclif conventions and TypeScript.
- Keep `url` as the only required positional argument for the first command.
- Prefer explicit flags for everything else: `--topic`, `--tags`, `--format`, `--ttl`, `--tier`, `--force`, `--json`.
- Use kebab-case flag names.
- Support `--json` for agent callers and keep logs/warnings out of stdout in JSON mode.
- Return actionable errors with stable codes and suggestions.
- Avoid interactive prompts in agent workflows. Support `--no-input` if prompts are introduced later.
- Generate and ship `oclif.manifest.json` before publishing.

## Storage rules

- Store durable research artifacts under oclif's data directory via `this.config.dataDir`.
- Use oclif cache/config directories only for their intended purposes.
- Do not store production cache artifacts in the repository.
- Test fixtures may live in the repo, but they must be small, deterministic, and free of secrets.
- Use normalized URL hashes for collision-resistant file paths.
- Keep YAML frontmatter as the source of truth. Index files must be rebuildable from stored notes.

## Research artifact requirements

Every stored note should preserve:

- source URL and normalized URL
- topic and tags
- fetched and validated timestamps
- freshness policy (`ttl` and/or tier)
- content hash
- token estimate
- status
- provenance
- detailed Markdown representation
- compressed Markdown representation or deterministic compression inputs

Compressed output is for context budgeting. Detailed output is for exact technical details, links, tables, and code examples.

## Extraction rules

- Treat fetched HTML as untrusted input.
- Reject non-HTTP(S) URLs unless a later design explicitly supports local files.
- Enforce request timeout, redirect, and maximum response-size limits.
- Prefer a static fetch first.
- Use a browser fallback only when the static content is not sufficient.
- Use Readability for main-content extraction.
- Use Turndown for Markdown conversion.
- Configure Markdown output deterministically, including ATX headings and fenced code blocks.
- Sanitize unsafe content before storing or rendering.

## Freshness and revalidation

Mirror the manual researcher protocol:

- `stable`: long-lived standards and pinned references
- `standard`: vendor/API docs and normal technical references
- `volatile`: release notes, changelogs, security advisories, latest pages, and beta docs

Freshness should be calculated at lookup time. Stale entries should be revalidated before a full re-fetch when possible. Never overwrite a good cache note with an error response. Archive superseded notes instead of deleting them.

## Testing expectations

Add focused tests with each implementation change. Cover:

- argument and flag validation
- URL normalization and hashing
- TTL/tier freshness calculation
- cache hit, stale hit, miss, and revalidation paths
- JSON output shape
- stdout/stderr behavior in JSON mode
- Readability/Turndown conversion with representative HTML fixtures
- compressed versus detailed output
- invalid, oversized, redirected, and timed-out fetches

## Keep scope tight

This repo currently contains planning material, generated agent instructions, and skills. Do not refactor generated IDE instruction files unless the task explicitly asks for it. Implement the reusable oclif plugin in normal source files in this repository when the package is scaffolded, and keep generated/manual protocol files as reference material.

---

## Active Agent Research Workflows (Drinking Our Own Champagne)

Agents working in this codebase or utilizing this plugin must run the compiled CLI research subcommands directly instead of executing manual web-scrapes or manual researcher workflows:

* **Retrieve / Cache Scrape**: `node bin/cli.mjs research <url> [--json]`
* **Retrieve (Browser-Rendered SPA)**: `node bin/cli.mjs research <url> --rendered [--json]`
* **Import Synthesized Notes**: `node bin/cli.mjs research import <url> --file <path> [--json]`
* **Status Checklist**: `node bin/cli.mjs research status <url> [--json]`
* **Inspect Metadata**: `node bin/cli.mjs research inspect <url> [--json]`
* **Search Cache**: `node bin/cli.mjs research search "<query>" [--json]`
* **Remote Docs Search (discovery)**: `node bin/cli.mjs research search "<query>" --remote <docs-url> [--json]` — discovers uncached pages via a site's public search (Algolia DocSearch, MkDocs/Sphinx/Just-the-Docs indexes); selected URLs are then captured through `research <url>`. Degrades to local cache search when no connector applies.
* **List Database**: `node bin/cli.mjs research list [filters] [--json]`
* **Prune Database**: `node bin/cli.mjs research prune [filters] --yes [--json]`

Published standalone usage is `npx @taurgis/bonsai research <url>` or `bonsai research <url>` after installation. Do not document bare `npx bonsai` unless an unscoped npm shim is actually published.

### Browser-Rendered Extraction (`--rendered`)

Use `--rendered` when the target page is a Single Page Application (SPA) or relies on client-side JavaScript rendering. This flag launches a headless Chrome instance via the Chrome DevTools Protocol (CDP) using the native `WebSocket` API (Node 22+). No additional npm dependencies are required.

- Chrome or Chromium must be installed locally, or set `CHROME_PATH` to the executable.
- Resource blocking is enabled (CSS, images, fonts, media) to reduce load time.
- The same DNS safety, URL validation, body size limits, and timeout constraints apply.
- The resulting `capture_method` metadata is set to `browser_fallback`.

### Advanced Full-Text Search

`research search` now supports fuzzy matching (Levenshtein distance ≤ 2 for terms ≥ 4 chars), term frequency ranking, substring matching in topics and tags, and exact phrase match bonuses for multi-word queries.
