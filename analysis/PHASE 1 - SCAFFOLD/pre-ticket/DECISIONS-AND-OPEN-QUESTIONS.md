# Decisions and Open Questions

Use this before ticket creation. Decisions are items that can be treated as current direction. Open questions must be answered before tickets depend on them.

## Decisions

### D1. Preserve the Manual Research Protocol

The CLI should migrate, not replace, the current `Official Docs Researcher` behavior:

- cache-first lookup
- source-cited notes
- frontmatter metadata
- freshness tiers
- stale revalidation
- no overwriting good notes with errors

### D2. Follow the Existing `forward-nexus` JSON Envelope

The target CLI has a stable project-specific JSON envelope. Research should use that envelope instead of adopting oclif's default `enableJsonFlag` serialization.

### D3. Store Durable Artifacts Outside the Repository

Use `this.config.dataDir` for durable research artifacts. Repository-local `artifacts/online-research/` is part of the manual subagent workflow and should not be the default production storage for the reusable CLI.

### D4. Treat Web Content as Untrusted

Fetched HTML, Markdown, URLs, metadata, and titles are untrusted input. They must not be executed. They must not be trusted for filesystem paths. Unsafe schemes and oversized responses should fail early.

### D5. Prefer Static Fetch First

A static HTTP fetch plus Readability/Turndown should be the first implementation target. Browser rendering is useful for SPAs but should be a scoped follow-up with explicit timeout, resource, and sandbox constraints.

### D6. Keep Plugin Command Classes Thin

In this repository's plugin package, `src/commands/research.ts` should only define oclif metadata and map parsed input to `src/lib/research/*`.

### D7. The Cache Index Is Rebuildable

Frontmatter is the durable source of truth. Any index or manifest is a performance structure and must be rebuildable from artifact files.

### D8. Prefer Stdlib and In-Repo Helpers for Small Glue

Do not add packages for URL normalization, TTL parsing, token estimates, cache key hashing, atomic writes, frontmatter emission, or Markdown compression filters unless a spike proves the in-repo version is brittle. See `TECHNICAL-RESEARCH.md`.

### D9. Deliver as an Optional Plugin From This Repository

The research capability is developed in this repository as an optional oclif plugin for the `forward-nexus` host CLI. It is not a core command in `/Users/thomastheunen/Documents/Projects/forward-nexus`. Host repo changes are limited to optional plugin loading/support, documentation, and dogfooding decisions.

## Open Questions

### Q1. Host Plugin Enablement

How will the `forward-nexus` host load this optional research plugin for local development, dogfooding, and eventual distribution?

Why it matters:

- The target CLI does not currently expose user-installable plugin support.
- oclif documents `@oclif/plugin-plugins` as the path when users should install their own plugins.
- A separate plugin may require plugin-host enablement and security review in the host repo.
- The plugin still needs to match the host JSON envelope, exit codes, help style, and stdout/stderr contract.

Recommendation: implement the plugin package here first, then decide the narrow host integration path needed to load it without making research a core command.

### Q2. URL Versus Topic as the Primary Cache Key

The manual workflow uses topic slugs. The plugin proposal uses normalized URL hashes.

Options:

- URL-first: one artifact per normalized source URL.
- Topic-first: one synthesized note per topic, potentially combining multiple sources.
- Hybrid: source artifacts plus topic notes that reference them.

Recommendation: URL-first for the first implementation. Topic synthesis can build on top of source artifacts later.

### Q3. `--ttl` and `--tier` Interaction

Do agents pass explicit TTLs, named tiers, or both?

Options:

- `--tier` only, with fixed policy windows.
- `--ttl` only, fully agent-driven.
- Both, with `--ttl` overriding `--tier`.

Recommendation: support both eventually; start with `--tier standard` default and optional `--ttl` override.

### Q4. Stale-Within-Grace Exit Code

If the source is unavailable but a stale artifact is within grace, should the command exit `0` or `5`?

Recommendation: use `0` only when the caller explicitly permits stale serving, otherwise `5` for partial success with a clear warning. Decide before writing contract tests.

### Q5. Browser Fallback Boundary

When should the command invoke Playwright or another browser renderer?

Needed before ticketing browser work:

- maximum page load time
- maximum response/body size
- resource blocking policy
- user-agent string
- robots policy
- whether fallback is automatic or requires `--rendered`

Recommendation: do not include browser fallback in the first implementation slice.

### Q6. Sanitization Library

Readability extracts content but does not make untrusted HTML safe for all downstream uses. Decide whether stored detailed Markdown needs DOM sanitization before Turndown, after Turndown, or both.

Recommendation: ticket a security spike before implementing rendered HTML fallback or any HTML output mode.

### Q7. Multi-Source Research Notes

The manual researcher can synthesize a topic from several official sources. The automatic `research <url>` fetch command should stay single-source, but agent-supplied import may store a multi-source research note.

Options:

- keep `research <url>` single-source
- allow `research import --source-url ... --stdin` for agent-supplied multi-source notes
- add `research topic <query>` later
- add `research add-source` / `research synthesize`

Recommendation: keep first implementation single-source for automatic fetching. Allow multi-source agent-supplied imports after the cache/artifact contract is stable. Add CLI-generated topic synthesis only after that.

### Q8. Dependency Policy

Likely dependency candidates include:

- `@mozilla/readability`
- `linkedom` or `jsdom`
- `turndown` if detailed Markdown is in scope
- possibly `playwright` later

Before ticketing dependency work, confirm package size, transitive dependency count, Node 22 compatibility, ESM support, license posture, and startup impact.

Current recommendation: use `@mozilla/readability`, spike `linkedom` before `jsdom`, use `turndown` only for detailed Markdown, and defer Playwright/Puppeteer. Copy small project-specific helpers into the repo instead of depending on packages like `ms`, `gray-matter`, `zod`, `p-limit`, or cache/lock libraries.

### Q9. Manual Cache Migration

Should existing `artifacts/online-research/*.md` notes be migrated into the CLI cache?

Recommendation: no automatic migration in v1. Provide an import command later if real users need it.

### Q10. Official-Docs Preference

The manual researcher prefers official documentation and uses project-specific helpers when available. A generic URL command cannot know whether a URL is official.

Options:

- caller is responsible for selecting URLs
- CLI warns when source host looks unofficial for a known vendor
- later `research official "<topic>"` command performs source discovery

Recommendation: caller responsibility for v1. Source discovery is a separate product.
