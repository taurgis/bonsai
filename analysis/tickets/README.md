# Implementation Tickets

These tickets turn the pre-ticket analysis and user stories into an implementation sequence for `forward-nexus research`.

Assumption for this ticket pack: ship the first version as an optional oclif plugin package developed in this repository. The main `forward-nexus` CLI is the host and dogfood target, not the implementation location. Browser rendering, multi-source topic synthesis, and manual cache migration are deferred until the plugin URL cache works.

## Ticket Sequence

| Ticket | Title | Depends on | Priority |
| --- | --- | --- | --- |
| [Handoff](JUNIOR-HANDOFF.md) | Shared junior implementation guide | None | Read first |
| [T-00](T-00-LOCK-IMPLEMENTATION-DECISIONS.md) | Lock implementation decisions | None | P0 |
| [T-01](T-01-COMMAND-SKELETON-AND-CONTRACT.md) | Add command skeleton and contract tests | T-00 | P0 |
| [T-02](T-02-URL-VALIDATION-AND-CACHE-KEY.md) | Validate URLs and derive cache keys | T-01 | P0 |
| [T-03](T-03-ARTIFACT-SCHEMA-AND-STORAGE.md) | Write and read research artifacts | T-02 | P0 |
| [T-04](T-04-CACHE-INDEX-AND-ATOMICITY.md) | Add scan-based lookup and atomic writes | T-03 | P0 |
| [T-05](T-05-STATIC-FETCHER.md) | Fetch static HTML with limits | T-02 | P1 |
| [T-06](T-06-EXTRACTION-DEPENDENCY-SPIKE.md) | Choose DOM and extraction dependencies checklist | T-05 | P1 |
| [T-07](T-07-READABILITY-MARKDOWN-PIPELINE.md) | Extract detailed Markdown | T-06 | P1 |
| [T-08](T-08-COMPRESSED-OUTPUT-AND-TOKEN-ESTIMATES.md) | Add compressed output and token estimates | T-07 | P1 |
| [T-09](T-09-FRESHNESS-AND-REVALIDATION.md) | Add freshness and stale revalidation | T-05, T-08 | P1 |
| [T-10](T-10-END-TO-END-CLI-CONTRACT.md) | Harden JSON and human output contracts | T-09 | P1 |
| [T-11](T-11-DOCS-RELEASE-AND-DOGFOOD.md) | Document, release-check, and dogfood MVP | T-10 | P1 |
| [T-12](T-12-DEFERRED-ENHANCEMENTS.md) | Track post-MVP enhancements | T-11 | P2 |
| [T-13](T-13-AGENT-SUPPLIED-RESEARCH-IMPORT.md) | Add agent-supplied research import | T-10 | P2 |
| [T-14](T-14-STATUS-INSPECT-DRY-RUN.md) | Add status, inspect, dry-run, and max-age | T-10 | P2 |
| [T-15](T-15-KEYWORD-CACHE-SEARCH.md) | Add keyword cache search | T-14 | P2 |

Deferred work lives in [backlog](backlog/README.md).

## Global Definition of Done

- The command follows the existing `forward-nexus` JSON envelope.
- Human mode sends returned research content to stdout and diagnostics to stderr.
- `--json` emits exactly one JSON document on stdout.
- Durable artifacts are stored under `this.config.dataDir`, not the repository.
- Web content is treated as untrusted data.
- Cache writes never destroy a valid existing artifact on fetch or parse failure.
- Dependency additions are justified against `analysis/pre-ticket/TECHNICAL-RESEARCH.md`.
- Plugin-package validation passes with focused tests first, then broad checks. Host dogfood validation passes once the plugin is linked or installed into `forward-nexus`.

## Junior Rule

If a ticket appears to require choosing product behavior, stop and update the ticket first. Implementation tickets should contain defaults, not hidden decisions.

## Preferred Validation Order

Run focused tests for the ticket first. Before release, run:

```bash
pnpm test:contract
pnpm type-check
pnpm docs:check
pnpm build
pnpm test
```

If `pnpm build` fails while generating licenses because the registry is unavailable, treat that as an environment issue before debugging implementation code.
