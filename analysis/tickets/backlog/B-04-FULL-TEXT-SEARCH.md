# B-04: Add Advanced Full-Text Cache Search

## Goal

Improve search inside cached research artifacts after the simple scan-based `research search` command exists.

## Scope

- Add a search index only if scan-based search becomes too slow.
- Consider fuzzy matching or ranking improvements.
- Keep result output compatible with `research search`.

## Not Before

- T-15 exists and real usage proves simple scan-based search is not enough.
