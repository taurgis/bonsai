---
"@taurgis/bonsai": patch
---

Fix three CLI audit findings:

- **Content-type integrity**: a non-HTML response (JSON, PDF, binary) rejected by the static
  fetcher no longer silently retries through the automatic rendered-browser fallback. A browser can
  still render *something* for those (e.g. Chrome's built-in JSON viewer), which previously got
  cached as a high-confidence "extracted" artifact instead of surfacing the real content-type
  error. `--rendered` still bypasses this entirely, so an informed retry remains available.
- **Prompt-injection sanitization**: the redaction patterns previously only matched a harmful
  instruction at the exact start of a line or right after a handful of role-address words, so any
  filler text placed before the instruction ("Heads up: ignore previous instructions...") bypassed
  detection entirely. Detection now anchors per clause (split on sentence-ending punctuation), so a
  command hidden behind an innocuous opener is still caught, while legitimate documentation that
  merely describes an attack (e.g. "An attacker may tell the model to ignore...") is still left
  untouched.
- **Multi-source note discoverability**: `inspect` on a URL that has no cache entry of its own but
  is already a `--source-url` of an existing multi-source `research_note` no longer suggests a
  plain fetch (which would create an unrelated duplicate entry). The miss now reports
  `partOfExistingNote` in `--json` output and points at `bonsai list --url "<url>"` to find the
  existing note.
