# Risks and Validation Plan

This document lists the risks that should shape implementation tickets and acceptance criteria.

## Risk Register

| Risk | Impact | Mitigation |
| --- | --- | --- |
| JSON stdout polluted by progress output | Breaks agents and scripts | Use the existing JSON envelope and captured-output path; contract-test stdout. |
| Cache serves outdated volatile content | Agents make wrong decisions | Freshness tiers, grace limits, and successful revalidation for volatile sources. |
| Good artifact overwritten by network error | Data loss and repeated failures | Never overwrite on fetch failure; mark unavailable in result. |
| URL creates unsafe filesystem path | Path traversal or cache corruption | Hash normalized URL; never use raw URL as path. |
| SSRF or unsafe URL schemes | Local network or file exposure | Permit only HTTP(S) initially; reject localhost/private ranges if policy requires. |
| Oversized page consumes memory | CLI crash or slow run | Enforce response byte limit and parse element limit. |
| Browser fallback runs arbitrary page code | Security and performance exposure | Defer fallback or gate behind explicit flag and strict time/resource limits. |
| HTML/Markdown injection in downstream tools | Unsafe rendering or prompt pollution | Sanitize untrusted HTML; treat stored Markdown as data, not instructions. |
| Duplicate cache entries for same page | Wasted storage and inconsistent answers | Normalize URLs and use one hash key per source. |
| Topic tags mutate cache identity | Near-duplicate notes | Keep tags as metadata, not key material. |
| Plugin delivery assumes unsupported host behavior | Tickets fail late | Build the plugin in this repo and ticket host plugin loading as a separate integration/security decision. |
| New dependencies bloat install/startup | Worse CLI UX | Measure package size and startup impact before adopting heavy dependencies. |
| Small utility dependencies multiply maintenance surface | Slower installs and more supply-chain risk | Copy tiny stable helpers into the repo instead of adding packages for TTL parsing, hashing, YAML-like output, or token estimates. |

## Security Validation

Tickets that touch fetching or storage should include tests for:

- rejects `file:`, `data:`, `javascript:`, and other non-HTTP(S) schemes
- rejects malformed URLs with exit `2`
- normalizes equivalent URLs consistently
- hashes cache paths without raw URL path traversal
- handles redirects with a maximum redirect count
- rejects or truncates oversized responses
- times out slow responses
- stores no request headers, cookies, auth tokens, or session data in artifacts
- strips scripts and unsafe HTML before Markdown conversion
- does not execute scripts in `jsdom`
- does not follow symlinks outside the cache root

## CLI Contract Validation

Add or update contract tests for:

- `research --help`
- missing URL
- invalid URL
- invalid `--format`
- invalid `--ttl`
- `--json` success envelope
- `--json` error envelope
- human stdout/stderr routing
- `--quiet`
- `--no-color`
- `--cwd`
- command-not-found suggestions unaffected

Expected JSON invariant:

```text
stdout = exactly one JSON document
stderr = empty unless the process itself fails before the envelope can be emitted
data = command-specific object or null
```

## Cache Behavior Validation

Unit-test the state machine:

- miss fetches and writes artifact
- fresh hit does not fetch
- `--force` fetches despite fresh cache
- stale unchanged bumps `validated_at`
- stale changed rewrites content and hash
- stale unavailable within grace returns configured warning behavior
- stale unavailable beyond grace exits failure and preserves old artifact
- volatile stale source is not trusted without successful revalidation
- corrupt index rebuilds from frontmatter
- corrupt artifact is skipped or archived with a clear diagnostic

## Extraction Validation

Fixture-test representative HTML:

- static docs page
- article with nav/sidebar/footer
- page with relative links
- page with code blocks
- page with tables
- page with images
- page with cookie banner
- page with no readerable main content
- page with non-English text

Assertions:

- detailed Markdown preserves headings and code fences
- relative links are resolved or intentionally preserved according to policy
- compressed output is shorter than detailed output
- compressed output retains titles, warnings, code/API names, and important version constraints
- script/style/nav/footer content does not dominate the result

## Performance Validation

Measure and budget:

- cold cache miss for static fetch
- warm cache hit
- stale revalidation unchanged
- extraction on large-but-allowed page
- package startup before and after dependencies
- installed package size before and after dependencies
- direct and transitive dependency count before and after dependencies

Suggested initial budgets:

| Path | Budget |
| --- | --- |
| Fresh cache hit | < 100 ms command work after process startup |
| Static fetch + extraction | < 5 s default timeout |
| Stale unchanged revalidation | < 2 s when server responds normally |
| Max response size | Decide before ticketing; start conservative |

## Documentation Validation

Tickets should update docs when they change:

- command surface
- flags
- JSON shape
- exit codes
- cache storage path
- freshness policy
- security limitations
- browser fallback behavior

At minimum, update:

- root `README.md`
- `AGENTS.MD`
- relevant `analysis/pre-ticket/*` docs if decisions change
- host repo docs only when a ticket changes how `/Users/thomastheunen/Documents/Projects/forward-nexus` loads or documents optional plugins

## Suggested Test Commands

For the plugin package, define local scripts when scaffolding lands. For host dogfooding, mirror the host CLI's existing verification style:

```bash
pnpm test
pnpm test:contract
pnpm type-check
pnpm docs:check
pnpm build
```

For targeted work, prefer focused Vitest runs first, then the broader suite.
