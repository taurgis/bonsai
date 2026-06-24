# B-10: Add File-Based Import

## Goal

Allow importing saved Markdown files when stdin is awkward.

## Scope

- Add `research import --file <path>`.
- Reuse the same validation and artifact writer as stdin import.
- Do not execute or follow links from imported files.

## Not Before

- Stdin import is implemented and users have larger saved research files.
