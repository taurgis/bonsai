# Audit 4/8 — Trust-boundary security (#75)

GitHub issue comments, issue close, and `gh pr create` failed with `Resource not accessible by integration`. ManagePullRequest MCP was not available in this environment. Open the PR manually from:

https://github.com/taurgis/bonsai/pull/new/cursor/cli-audit-trust-boundary-19f3

Branch: `cursor/cli-audit-trust-boundary-19f3` @ `b1e3765` (+ this findings commit).

## Acceptance criteria

- [x] URL validation/normalization on every entry point with hostile cases
- [x] Hash-only artifact paths; traversal demo stays under store root
- [x] Stdin byte limit with clean `STDIN_TOO_LARGE`
- [x] Secret-scan + prompt-injection on every capture method; wiring tests fail if unhooked
- [x] Gap fixed at root cause (Salesforce browser path)
- [x] Findings recorded for #71 (this file — issue API blocked)
- [x] Full suite + gates green (863 tests; type-check / eslint / line-counts)

## Fixed (blocker)

**Salesforce site-module browser capture skipped `sanitizePromptInjection`.**

- File: `src/sites/salesforce-doc-fetch.ts` (`buildSalesforceFetchResult`)
- Citations:
  - `.cursor/rules/development.mdc` — validate URLs, paths, stdin, fetched HTML at trust boundaries
  - OWASP LLM01 / Prompt Injection Prevention Cheat Sheet (`.bonsai/research/7952100613d7af06f2ba3ee8274113cae58af10b8bdc4462ab2c3797db00bb0e.md`)
  - OWASP LLM01 (`.bonsai/research/430c5292e08d172042ae48044d9a6a852a5ec64877c2aa5196c45b389ace71c6.md`)
- Fix: sanitize before returning extraction Markdown (same as `extractHtmlContent` / `extractFromSource`)

## Verified intact

| Boundary | Evidence | Citations |
| --- | --- | --- |
| URL normalize (args/batch/import) | `normalizeUrl` via `resolveResearchTarget`; pins in `url.test.ts`, import unit, inspect contract | Input Validation CS (`.bonsai/research/c35c03d3…`); Node.js Security CS (`.bonsai/research/4da32170…`) |
| Hash-only paths | `deriveCacheKey` + `getArtifactPath`; traversal demo in `storage.test.ts` | Node.js Security CS — path traversal / fs input |
| Stdin limit | `INPUT_LIMIT_BYTES`; contract `STDIN_TOO_LARGE` | Repo CLI trust-boundary rule |
| Prompt-injection wiring | static / browser / route_markdown / github_source / Salesforce / import | OWASP LLM01 |
| Secret-scan wiring | All capture provenances → `persistArtifact` → `writeArtifactSecurely` | Repo secure-write policy |

## Deferred (minor)

Revalidate in-place writes use `writeArtifact` (no secret redirect). Documented intentional in `fetch-command-service.ts`. Not changed in #75.

## Sibling notes

Do not fix in this PR: #73 (CLI contract), #74 (read-only/plan-mode). #71 remains open for rollup.

## Gates

```
pnpm type-check          # pass
pnpm lint:eslint         # pass
pnpm lint:line-counts    # pass
pnpm exec vitest run     # 863 passed
```
