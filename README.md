# forward-nexus Research

This repository is the design and implementation workspace for a reusable optional `forward-nexus` research plugin.

The goal is to migrate the current manual research workflow from generated IDE instructions and subagents into a durable CLI command that agents can call directly. Instead of every agent re-reading raw web pages, stripping HTML, inventing cache files, and manually deciding whether sources are fresh, this project will provide a local research database optimized for agent consumption.

## Why this exists

Agents frequently need current official documentation before changing code, prompts, skills, workflows, or technical docs. The current system already defines that behavior in `.agents/rules/repo-research.md` and the generated `Official Docs Researcher` agent files under `.claude/`, `.cursor/`, and `.github/`.

That manual system works, but it is hard to reuse outside this repository and relies on agents following a long instruction document correctly. This project turns the same protocol into a CLI-backed cache:

- fetch official or user-provided URLs
- extract the main readable content from HTML
- convert it into deterministic Markdown
- store synthesized research notes with frontmatter metadata
- reuse fresh notes without network access
- revalidate stale notes cheaply before re-fetching
- return either compressed or detailed content for context budgeting
- expose deterministic JSON for agent workflows

## Product shape

The target command is delivered by an oclif plugin for `forward-nexus`, developed in this repository rather than inside the main `forward-nexus` CLI package:

```bash
forward-nexus research <url> \
  --topic "React Server Components" \
  --tags react --tags docs \
  --format compressed \
  --ttl 30d \
  --json
```

The command should behave like a local research result database. A first request fetches, extracts, converts, and stores the result. Later requests for the same normalized URL and compatible format should return from local storage while the entry is fresh.

The `/Users/thomastheunen/Documents/Projects/forward-nexus` repository remains the host CLI and compatibility target. Any changes there should be limited to optional plugin-host enablement, documentation, or dogfooding work needed to load this package; the research implementation itself belongs here.

## Current status

This repository is currently in the planning stage.

- `analysis/README.md` contains the architecture report, data model, command shape, and implementation tickets.
- `.agents/rules/repo-research.md` defines the manual repository requirement that this CLI is meant to replace.
- `.claude/agents/official-docs-researcher.md`, `.cursor/agents/official-docs-researcher.md`, and `.github/agents/official-docs-researcher.agent.md` contain the generated subagent protocol that should become executable CLI behavior.

There is not yet a TypeScript package, `package.json`, or oclif plugin command implementation in this repo.

## Core workflow

1. Normalize the URL and requested output mode into a deterministic cache key.
2. Look up the cache index in the oclif data directory.
3. If the entry exists and is fresh, return the requested Markdown variant.
4. If the entry is stale, revalidate with source metadata or a weak content hash before doing a full fetch.
5. On a miss or changed source, fetch the page, extract the main content, convert it to Markdown, and store the result.
6. Return a stable response with metadata, provenance, freshness state, token estimate, and content.

## Target data model

Each stored artifact should be a Markdown file with YAML frontmatter. The body should contain the detailed and compressed representations, or enough structured content to derive them deterministically.

Required metadata:

- `id`
- `source_url`
- `normalized_url`
- `topic`
- `tags`
- `format`
- `extracted_at`
- `validated_at`
- `stale_after`
- `ttl`
- `volatility_score` or `tier`
- `token_estimate`
- `content_hash`
- `status`

The manual researcher protocol uses freshness tiers (`stable`, `standard`, `volatile`). The implementation can preserve those tiers while still supporting explicit `--ttl` input from an agent.

## Technical direction

- Use oclif for plugin command parsing, help output, JSON mode, manifest generation, and OS-appropriate config/cache/data directories.
- Keep the public interface explicit: one required URL argument, with flags for metadata and behavior.
- Use `--json` for agent-facing execution and keep human progress/status output off stdout in JSON mode.
- Prefer static HTTP fetch first. Add a browser-rendered fallback only when the static response is not readerable.
- Use Mozilla Readability with a DOM implementation to isolate article content.
- Use Turndown to convert extracted HTML into deterministic Markdown with ATX headings and fenced code blocks.
- Store cache artifacts in `this.config.dataDir`, not inside the repository, except for tests and fixtures.
- Treat all fetched content as untrusted input. Sanitize before storing or rendering, reject dangerous URLs, bound response size, and enforce timeouts.

## Initial roadmap

1. Scaffold the oclif plugin package in this repository with TypeScript, build scripts, tests, and manifest generation.
2. Implement `research <url>` with validated `url`, `--topic`, `--tags`, `--format`, `--ttl`, and `--json`.
3. Build the cache key, frontmatter schema, index, and freshness calculation.
4. Implement static HTML fetch, Readability extraction, Turndown conversion, and compressed Markdown generation.
5. Add stale revalidation using content hashes and conditional HTTP metadata where available.
6. Add tests for cache hits, stale misses, invalid URLs, JSON output, TTL parsing, and compressed/detailed formatting.

## References

- [Architecture and implementation plan](analysis/README.md)
- [Repository research rule](.agents/rules/repo-research.md)
- [Official Docs Researcher agent](.github/agents/official-docs-researcher.agent.md)
- [oclif plugins](https://oclif.io/docs/plugins/)
- [oclif command discovery](https://oclif.io/docs/command_discovery_strategies/)
- [oclif JSON output](https://oclif.io/docs/json/)
- [Mozilla Readability](https://github.com/mozilla/readability)
- [Turndown](https://github.com/mixmark-io/turndown)
