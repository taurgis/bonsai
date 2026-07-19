# Agent Instructions

## Reporting style

When reporting information to the user, be extremely concise — sacrifice grammar for concision.

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
- `BaseCommand.baseFlags` (see `src/base-command.ts`) — currently `--read-only`/`--plan` — is merged into every command automatically via `BaseCommand.init()`'s `this.parse({ ..., baseFlags: this.ctor.baseFlags })` call; no per-command `static flags` change is needed to expose a new shared flag in `--help` or at runtime.
- Write commands (anything that persists or deletes) must call `this.effectiveDryRun(explicitDryRun)` rather than reading their own dry-run flag directly, so global read-only/plan mode (`--read-only`/`--plan`, `BONSAI_READ_ONLY`/`BONSAI_PLAN_MODE`) is honored consistently.
- Support `--json` for agent callers and keep logs/warnings out of stdout in JSON mode.
- Return actionable errors with stable codes and suggestions.
- Avoid interactive prompts in agent workflows. Support `--no-input` if prompts are introduced later.
- Generate and ship `oclif.manifest.json` before publishing.

## Naming conventions

Keep identifiers predictable so juniors (and agents) can scan code without guessing. ESLint enforces the TypeScript identifier rules below via `@typescript-eslint/naming-convention`.

- **Variables and parameters** — `camelCase`. Good: `cacheKey`, `dataDir`. Bad: `cache_key`, `DataDir`.
- **Functions and methods** — `camelCase`, preferably verb-led. Good: `normalizeUrl`, `writeArtifact`. Bad: `NormalizeUrl`, `write_artifact`.
- **Types, interfaces, and classes** — `PascalCase`. Good: `ResearchArtifact`, `SiteModule`. Bad: `researchArtifact`, `site_module`.
- **Module-level constants** — `UPPER_CASE` for true constants; `camelCase` for exported singletons/modules. Good: `TIMEOUT_MS`, `salesforceDeveloper`. Bad: `timeoutMs` for a fixed limit, `SalesforceDeveloper` for a value export.
- **Files and directories** — `kebab-case`. Good: `base-command.ts`. Bad: `baseCommand.ts`, `base_command.ts`.
- **CLI flags** — `kebab-case`. Good: `--read-only`. Bad: `--readOnly`, `--read_only`.
- **Environment variables** — `BONSAI_*` in `UPPER_CASE`. Good: `BONSAI_STORAGE`. Bad: `bonsaiStorage`, `BONSAI-storage`.
- **Artifact / frontmatter fields** — `snake_case` (schema contract with on-disk YAML). Good: `source_url`, `cache_key`. Bad: renaming those fields to `sourceUrl` in the schema.

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

This repo currently contains planning material, generated agent instructions, and skills. Do not refactor generated IDE instruction files unless the task explicitly asks for it. Implement Bonsai in normal source files in this repository, and keep generated/manual protocol files as reference material.

---

## Active Agent Research Workflows (Drinking Our Own Champagne)

Agents working in this codebase or utilizing Bonsai must run the compiled CLI commands directly instead of executing manual web-scrapes or manual researcher workflows:

- **Retrieve / Cache Scrape**: `node bin/cli.mjs <url> [--json]`
- **Retrieve (Browser-Rendered SPA)**: `node bin/cli.mjs <url> --rendered [--json]`
- **Import Synthesized Notes**: `node bin/cli.mjs import <url> --file <path> [--json]`
- **Status Checklist**: `node bin/cli.mjs status <url> [--json]`
- **Inspect Metadata**: `node bin/cli.mjs inspect <url> [--json]`
- **List Database**: `node bin/cli.mjs list [filters] [--json]`
- **Prune Database**: `node bin/cli.mjs prune [filters] --yes [--json]`

Published standalone usage is `npx @taurgis/bonsai <url>` or `bonsai <url>` after installation. Do not document bare `npx bonsai` unless an unscoped npm shim is actually published.

Intentional CLI asymmetries to preserve:

- `fetch` stays hidden from the command list; the primary UX is URL shorthand (`bonsai <url>` / `node bin/cli.mjs <url>`), with `bonsai help fetch` as the detailed URL-form reference.
- `status --tier` has no default; omitting it evaluates freshness against the cached artifact's stored tier.
- `list --artifact-type` omits `section` so listings stay page-level; `prune --artifact-type` includes `section` so cleanup can target every artifact type.
- Short flags are command-local (`-f` is fetch format but import file; `-g` is tags on cache commands but global scope on config commands). Check command help before reusing short flags.

### Browser-Rendered Extraction (`--rendered`)

Use `--rendered` when the target page is a Single Page Application (SPA) or relies on client-side JavaScript rendering. This flag launches a headless Chrome instance via the Chrome DevTools Protocol (CDP) using the native `WebSocket` API (Node 22+). No additional npm dependencies are required.

- Chrome or Chromium must be installed locally, or set `CHROME_PATH` to the executable.
- Resource blocking is enabled (CSS, images, fonts, media) to reduce load time.
- The same DNS safety, URL validation, body size limits, and timeout constraints apply.
- The resulting `capture_method` metadata is set to `browser_fallback`.

### Manual CLI audit (`pnpm audit:cli`) — keep it up to date

`testing/manual-audit.mjs` is the entry point for a living, end-to-end inventory of the CLI's
happy and unhappy flows. It runs the **built** `bin/cli.mjs` (building once if `dist/` is missing)
in an isolated cwd + XDG sandbox per invocation and asserts exit codes, stdout/stderr routing,
JSON envelopes, and on-disk cache side effects. Run it with `pnpm audit:cli`. Opt into extra
network-heavy scenarios (live `--rendered` fetch) with
`AUDIT_NETWORK=1 pnpm audit:cli`.

It is split for manageability and must stay that way as the CLI grows:

- `testing/audit/harness.mjs` — build guard, sandbox, and `run`/`check`/`expect`/`parseJson`/`report`.
- `testing/audit/fixtures.mjs` — shared URLs, workspaces (`createWorkspace`), and note files for import.
- `testing/audit/scenarios/*.mjs` — one file per command area, each exporting a
  `register(harness, fixtures)` function. Register new modules in `testing/manual-audit.mjs`.

**Requirement:** keep this audit current. Whenever you change CLI behavior — a command, alias,
flag, stdout/stderr routing, exit code, or cache side effect — update the matching scenario
module in the same change. **When you uncover an end-to-end flow (happy or unhappy) that the audit
does not yet cover, add it** to the relevant scenario module (or add a new module and register it).
Run `pnpm audit:cli` and confirm it is green before finishing. Under `--json`, warnings and human
messages go to **stderr**; machine output stays on stdout — assert accordingly.

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues (via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default triage roles: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.
