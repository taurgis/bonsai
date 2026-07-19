# Final audit report — #71 Best-practices code audit

**Parent:** [#71](https://github.com/taurgis/bonsai/issues/71)  
**Synthesis:** [#79](https://github.com/taurgis/bonsai/issues/79)  
**Baseline:** `4bc0d4b` (pre-#72) → `main` at synthesis  
**PRs:** #80–#81 (#72), #83 (#73), #82 (#74), #84 (#75), #85 (#76), #86 (#77), #87 (#78), synthesis PR for #79  

This report rolls up every finding from tickets **#72–#78** with outcome (**fixed** / **deferred** + severity / **rejected** + reason) and citations. Platform-behavior claims cite official URLs warmed into `.bonsai/research/` during #72.

**Leave #71 open** for the maintainer to close after reading this report.

---

## User-visible effects (changesets)

| Ticket | User-visible? | Changeset |
| --- | --- | --- |
| #72 | No (contract pins + research cache warm only) | none |
| #73 | **Yes** — `--json` stream routing; fetch envelope `command: "fetch"` | `.changeset/cli-audit-contract-integrity-19f3.md` |
| #74 | **Yes** — `list`/`inspect` no longer write `.search-index.json` under effective read-only | `.changeset/cli-audit-readonly-plan-mode-19f3.md` |
| #75 | **Yes** (security) — Salesforce browser captures sanitized for prompt injection | `.changeset/cli-audit-trust-boundary-19f3.md` |
| #76 | No (internal delete/fold/unexport) | none |
| #77 | No (tests only) | none |
| #78 | No (JSDoc / internal renames / named constants; external contract byte-stable) | none |
| #79 | No additional user-visible effect beyond the changesets above | none (this synthesis) |

---

## Official sources cited (`.bonsai/research/`)

| Source | URL |
| --- | --- |
| CLI Guidelines (basics / streams) | https://clig.dev/ · https://clig.dev/#the-basics |
| CLI Guidelines (configuration / dry-run) | https://clig.dev/#configuration |
| oclif JSON mode | https://oclif.io/docs/json/ |
| oclif error handling | https://oclif.io/docs/error_handling/ |
| Node.js `process` / signals | https://nodejs.org/api/process.html |
| Node.js Security Cheat Sheet (paths / input) | OWASP Node.js Security CS (cached under `.bonsai/research/4da32170…`) |
| Input Validation Cheat Sheet | OWASP Input Validation CS (cached under `.bonsai/research/c35c03d3…`) |
| LLM01 Prompt Injection | OWASP LLM01 (cached under `.bonsai/research/79521006…`, `430c5292…`) |
| Repo rules | `.agents/rules/development.md` (junior readability, ponytail, CLI best practices); `AGENTS.MD` naming; thermo-nuclear + ponytail skills |

---

## Findings by ticket

### #72 — Pin CLI contract + warm research cache ([PR #80](https://github.com/taurgis/bonsai/pull/80), follow-up [#81](https://github.com/taurgis/bonsai/pull/81))

| Sev | Finding | Outcome | Citation |
| --- | --- | --- | --- |
| — | Contract pin suite for success/failure exits, envelopes, help, streams, determinism | **fixed** (prefactor; no CLI behavior change) | #71 Testing Decisions — contract runner |
| major | `list --json` empty-cache Warning on process stderr | **deferred → fixed in #73** | oclif JSON https://oclif.io/docs/json/ ; repo stream rules |
| major | `--json` error stderr mirroring inconsistent (CACHE_MISS vs usage) | **deferred → fixed in #73** | clig.dev / repo stream rules |
| minor | fetch envelope `command: "bonsai"` (not `"fetch"`) | **deferred → fixed in #73** | envelope consistency |
| nit | fallow CRAP>30 on four helpers (pre-existing on `main`) | **deferred** | structural health; not introduced by audit |

### #73 — CLI contract integrity ([PR #83](https://github.com/taurgis/bonsai/pull/83))

| Sev | Finding | Outcome | Citation |
| --- | --- | --- | --- |
| major | `list --json` empty-cache Warning on stderr | **fixed** | clig.dev streams; repo CLI output rules |
| major | `--json` CACHE_MISS vs usage-error stderr mirroring | **fixed** | oclif JSON log suppression https://oclif.io/docs/json/ |
| minor | fetch `command: "bonsai"` | **fixed** → `"fetch"` | intentional contract change; pinned |
| minor | no `--json` truncation notice | **deferred** | capped `data` still observable |
| nit | fallow CRAP>30 | **deferred** | pre-existing |

### #74 — Read-only / plan-mode ([PR #82](https://github.com/taurgis/bonsai/pull/82); detail `AUDIT_74_FINDINGS.md`)

| Sev | Finding | Outcome | Citation |
| --- | --- | --- | --- |
| major | `list`/`inspect` wrote `.search-index.json` under effective read-only | **fixed** — `persistIndex: !this.readOnly` | repo CLI read-only rule; https://clig.dev/#configuration |
| minor | Contract runner inherited `BONSAI_READ_ONLY`/`BONSAI_PLAN_MODE` | **deferred → fixed in #77** | test fidelity |
| nit | `pruneFlagError` reads raw `--dry-run` for `--yes` exclusion | **deferred** | intentional; not a write-path bug |

### #75 — Trust-boundary security ([PR #84](https://github.com/taurgis/bonsai/pull/84); detail `AUDIT_75_FINDINGS.md`)

| Sev | Finding | Outcome | Citation |
| --- | --- | --- | --- |
| blocker | Salesforce `browser_fallback` skipped `sanitizePromptInjection` | **fixed** in `buildSalesforceFetchResult` | development.md trust boundaries; OWASP LLM01 |
| — | URL normalize / hash-only paths / stdin limit / secret-scan wiring | **verified intact** | Input Validation CS; Node.js Security CS |
| minor | Revalidate in-place writes skip secret redirect | **deferred** (intentional) — documented in `fetch-command-service.ts` + `revalidate.ts` `ponytail:` note | #75 / #79 |

### #76 — Structural quality / minimalism ([PR #85](https://github.com/taurgis/bonsai/pull/85))

| Sev | Finding | Outcome | Citation |
| --- | --- | --- | --- |
| major | `writeJsonErrorStderr` thin pass-through | **fixed** | thermo-nuclear / ponytail |
| major | Dead `postJson` | **fixed** | ponytail YAGNI |
| major | Over-exported private helpers | **fixed** | ponytail / #76 AC |
| major | Positional `createArtifactFromFetch` half-migration | **fixed** | prior audit `7f46be8` |
| major | Import `padEnd` vs `formatHumanField` | **fixed** | thermo-nuclear duplication |
| major | Status/fetch freshness recipe duplication | **fixed** | shared-layer fold |
| major | `CAPTURE_DEPS` identity wrappers | **fixed** | thermo-nuclear |
| minor | `getPolicy` nested ternaries | **fixed** | development.md |
| minor | Duplicate stale-serve warnings | **fixed** | thermo-nuclear |
| nit | Stale `FLAGS_WITH_VALUES` comment | **fixed** | half-migration |
| — | Alias `BrowserFetchResult` → `FetchResult` | **rejected** (YAGNI / no new abstraction in audit) | #71 Implementation Decisions |

### #77 — Test fidelity ([PR #86](https://github.com/taurgis/bonsai/pull/86))

| Sev | Finding | Outcome | Citation |
| --- | --- | --- | --- |
| major | Contract runner inherited read-only env | **fixed** — scrub in `runner.ts` | deferred from #74; #71 Testing Decisions |
| blocker | Fetch freshness `stale_grace` / natural `stale_expired` unpinned | **fixed** | #77 AC |
| blocker | 304 path under-asserted (`validated_at` / body) | **fixed** | #77 AC |
| major | BaseCommand / status / inspect private envelope reach-in | **fixed** | highest seam |
| major | list truncation / prune internals spies | **fixed** | behavior pins |
| minor | Duplicate freshness + header call-shape asserts | **fixed** | no call-order pins |
| nit | `cli-emit` / `help-preflight` / `cache-view` only transitive coverage | **deferred** | exercised via contract |
| minor | list section-filter still mocks `scanCacheDirs` | **deferred** | fixture isolation; outcome asserted |
| minor | import stdin hook call asserts | **deferred** | fixture injection; outcomes asserted |

### #78 — Junior readability ([PR #87](https://github.com/taurgis/bonsai/pull/87))

| Sev | Finding | Outcome | Citation |
| --- | --- | --- | --- |
| major | Missing JSDoc on audited exports | **fixed** | `.agents/rules/development.md` § Readability |
| major | Non-intent names (`getPolicy`, `exitCodeOf`, …) | **fixed** (internal only) | same; `AGENTS.MD` |
| major | Magic exit / fetch / freshness literals | **fixed** — `EXIT_*`, defaults, tier days | same; https://clig.dev/#the-basics |
| minor | Narrating comments / missing `ponytail:` | **fixed** | ponytail skill |
| nit | Full JSDoc on research pipeline internals | **deferred** | out of #71 refactor-surface scope |
| — | Renaming envelope fields / error codes / flags | **rejected** | naming-frozen external contract |

### #79 — Synthesis (this ticket)

| Sev | Finding | Outcome | Citation |
| --- | --- | --- | --- |
| minor | `inspect --read-only` search-index pin missing (list pinned) | **fixed** in synthesis | Senior Quality Engineer #79 |
| minor | Revalidate secret-skip undocumented at write sites | **fixed** — `ponytail:` on `revalidate.ts` | Senior Quality Engineer #79 |
| nit | `REDIRECT_STATUS_CODES` tuple cast | **fixed** — `Set.has` | Senior Code Reviewer #79 |
| major | `hasValidHelpTarget` CRAP≥30 (0% matched coverage) blocked coverage-backed health | **fixed** — colocated `help-preflight.test.ts` | fallow `maxCrap: 30`; #71 quality gates |

---

## Review chain (#79)

| Gate | Result |
| --- | --- |
| Ponytail self-review on cumulative audit | Applied — no new abstractions; cheap minors fixed in synthesis |
| Thermo-nuclear self-review | Prior #76 pass held; no new spaghetti/layers in synthesis |
| Senior Code Reviewer (`4bc0d4b...HEAD`) | **APPROVE** — blockers/majors: none; one nit fixed |
| Senior Quality Engineer | **Ready to close** — blockers/majors: none; minors fixed; contract **120+** green |
| Coverage-backed fallow health | **green** — 0 functions above `maxCrap` (was 1: `hasValidHelpTarget`) |

---

## Quality gates at synthesis

Run on the #79 branch before merge:

- `pnpm type-check`
- `pnpm lint:eslint` (max-warnings 0)
- `pnpm lint:line-counts`
- `pnpm test:coverage` + `pnpm exec fallow health` (coverage-backed health)
- `pnpm exec vitest run` (full suite)
- `pnpm exec vitest run tests/contract`

---

## Open follow-ups (not gates for closing the audit)

| Item | Sev | Notes |
| --- | --- | --- |
| fallow CRAP>30 on four pre-existing helpers | nit | Unchanged vs pre-audit `main` |
| Secret re-scan on in-place revalidation | minor | Tracked; intentional ponytail ceiling |
| Soft line-count of large command services | nit | Prefer further deletion over splits |
| Close #72 / #75 if still open | process | Work merged via #80/#81/#84; issue APIs often blocked for cloud agents |

---

## Closing statement

The CLI structural refactor is **verified closed** against the seven audit dimensions in #71. Intentional user-visible corrections (#73 streams/command id, #74 read-only index sidecar, #75 Salesforce sanitize) are changesetted and contract-pinned. Internal audits (#76–#78) preserved the external contract. Synthesis (#79) completed the mandatory review chain and recorded this rollup.

**Maintainer action:** close #71 after accepting this report; leave child tickets closed via their PRs.
