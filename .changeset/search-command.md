---
"@taurgis/bonsai": minor
---

Adds `bonsai search`, closing the "no way to filter by tags/content" gap in `list`. `--query`
ranks cached page-level artifacts by keyword across topic, tags, `summary`, and `compressed`
content (case-insensitive, every term must match unless `--match-any` is set), reusing the same
`--topic`/`--tags`/`--url`/`--freshness`/`--artifact-type`/`--capture-method` filters as `list`.
Each row adds a relevance `score`, the fields a match came from (`matchedFields`), and a short
excerpt around the first content match (`snippet`) — an agent can judge relevance from that alone
before deciding to `inspect` or re-fetch. Following the existing token-optimization conventions
(TOON, minimal-by-default rows, pre-computed `summary` aggregates), `search` reads only the
already-indexed `summary`/`compressed` text (never the larger `detailed` body) so ranking a large
cache stays fast, and defaults `--limit` to 20 (lower than `list`'s 50) since a ranked row carries
more payload per entry. Omitting `--query` behaves like `list`: every row scores `0`, sorted
newest-first, so `search` is a strict superset of `list`'s filtering.
