# B-02: Add `research prune`

## Goal

Clean old or inactive artifacts when cache size becomes a real problem.

## Scope

- Start with `--dry-run`.
- Support `--older-than`, `--inactive`, and `--artifact-type`.
- Never delete active artifacts without explicit confirmation or `--yes`.

## Not Before

- Users have enough cached artifacts that cleanup is painful.
