---
"@taurgis/bonsai": minor
---

Manual CLI audit fix: `prune` had no way to delete cached entries by `--topic` or `--tags`, even though `list` could filter on both — the only workaround was an age or URL-glob filter, which doesn't help when entries share a topic/tag across unrelated URLs. `prune` now accepts `--topic`/`--tags` with the exact same matching semantics, flag characters, and help text as `list`.

Also fixes an inconsistency in `list`'s existing filters: an empty `--topic` silently matched every entry (a no-op filter) while an empty `--tags` entry silently matched none, and neither warned. Both now reject with `INVALID_FLAG_VALUE`, the same way an empty `--url` glob already does — an empty filter value is almost always a shell-quoting mistake, not an intentional "match everything" or "match nothing". This validation now applies to `prune`'s new `--topic`/`--tags` flags too.
