---
status: done
historic: true
completed_at: 2026-06-24
implementer: Antigravity AI
---

# B-01: Add `research list`

## Goal

List cached research artifacts without printing full content.

## Scope

- Filter by topic, tag, freshness, artifact type, and capture method.
- Return artifact path, source count, freshness, token estimates, and quality metadata.
- Support `--json`.

## Implementation Status

- **Status**: Done
- **Target Files**:
  * [src/commands/research/list.ts](file:///Users/thomastheunen/Documents/Projects/forward-nexus-research/src/commands/research/list.ts)
  * [src/commands/research/list.test.ts](file:///Users/thomastheunen/Documents/Projects/forward-nexus-research/src/commands/research/list.test.ts)
- **Validation**: Verified passing full unit test suite and Fallow metrics.
