---
status: done
historic: true
completed_at: 2026-06-24
implementer: Antigravity AI
---

# B-02: Add `research prune`

## Goal

Clean old or inactive artifacts when cache size becomes a real problem.

## Scope

- Start with `--dry-run`.
- Support `--older-than`, `--inactive`, and `--artifact-type`.
- Never delete active artifacts without explicit confirmation or `--yes`.

## Implementation Status

- **Status**: Done
- **Target Files**:
  * [src/commands/research/prune.ts](file:///Users/thomastheunen/Documents/Projects/forward-nexus-research/src/commands/research/prune.ts)
  * [src/commands/research/prune.test.ts](file:///Users/thomastheunen/Documents/Projects/forward-nexus-research/src/commands/research/prune.test.ts)
- **Validation**: Verified passing full unit test suite, safety confirmation requirements, and Fallow complexity thresholds.
