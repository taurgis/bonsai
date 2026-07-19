# Audit #74 findings (Agent B)

Branch: `cursor/cli-audit-readonly-plan-mode-19f3` @ `fd1ca90`
PR: **blocked** — ManagePullRequest MCP unavailable; `gh pr create` / issue comments → `Resource not accessible by integration`.
Create PR manually: https://github.com/taurgis/bonsai/compare/main...cursor/cli-audit-readonly-plan-mode-19f3?expand=1

## Fixed (this PR)

| Sev | Finding | Cite | Fix |
|-----|---------|------|-----|
| major | `list`/`inspect` wrote `.search-index.json` under effective read-only via `scanCacheDirs` → `loadIndexedArtifactsForDir` | Repo CLI best practices (`Honor read-only/plan mode in any code path that writes`); clig.dev Configuration (dry-run/safe mode) `.bonsai/research/` → https://clig.dev/#configuration | Optional `persist` / `persistIndex: !this.readOnly`; contract pin |

## Verified OK (no code change)

- fetch / import / prune / config set|unset all call `effectiveDryRun` (not raw dry-run) for write decisions
- Four spellings suppress writes; fetch still returns content (`would_fetch`)
- Config `would_set`/`would_unset`; both storage modes leave no artifact/index/config
- Vocabulary: human `[dry-run]` + JSON `dryRun` + `would_*`

## Deferred / sibling notes for #71

| Sev | Note | Ticket |
|-----|------|--------|
| minor | Contract runner does not scrub inherited `BONSAI_READ_ONLY`/`BONSAI_PLAN_MODE` (unlike `BONSAI_STORAGE`) — ambient harness env can leak into contract tests | #71 / test fidelity (#78?) |
| nit | pruneFlagError reads raw `--dry-run` for `--yes` mutual exclusion (intentional; `readOnly` passed separately) — not a write-path bug | record only |
| — | Do not fix #73 (exit codes/streams) or #75 (trust-boundary) in this branch | siblings |

## Gates

- `pnpm type-check` ✅
- `pnpm lint:eslint` ✅
- line-counts via `node --experimental-strip-types scripts/check-line-counts.ts --all` ✅ (plain `node scripts/*.ts` broken on Node 22.14 in this env)
- `pnpm exec vitest run` ✅ 858 passed / 69 files

## AC status (#74)

All checkboxes met on the branch above. Issue close/comment also blocked by integration permissions.
