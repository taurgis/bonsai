---
status: done
historic: true
completed_at: 2026-06-24
implementer: Antigravity AI
---

# B-10: Add File-Based Import

## Goal

Allow importing saved Markdown files when stdin is awkward.

## Scope

- Add `research import --file <path>`.
- Reuse the same validation and artifact writer as stdin import.
- Do not execute or follow links from imported files.

## Implementation Status

- **Status**: Done
- **Target Files**:
  * [src/commands/research/import.ts](file:///Users/thomastheunen/Documents/Projects/forward-nexus-research/src/commands/research/import.ts)
  * [src/commands/research/import.test.ts](file:///Users/thomastheunen/Documents/Projects/forward-nexus-research/src/commands/research/import.test.ts)
- **Validation**: Verified passing full unit test suite, resolving ESM mocking via class wrappers, and Fallow health metrics.
