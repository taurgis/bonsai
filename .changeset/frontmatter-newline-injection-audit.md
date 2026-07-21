---
"@taurgis/bonsai": patch
---

Close a frontmatter-corruption gap: an agent-supplied `--topic` or `--tags` value containing a raw newline was stored verbatim into the cached artifact's YAML-style frontmatter, which is one field per line. A newline could inject a bogus extra line — at worst a spoofed `key: value` pair, or a bare `---` that closed the frontmatter fence early and spliced the rest of the metadata (and even body sections) into what the parser then treated as free text, silently losing `tags`, `capture_method`, `content_hash`, `token_estimate`, and other fields. `fetch`/`import` now reject a `--topic`/`--tags` value containing a line break with a new `INVALID_METADATA_VALUE` error before any cache write is attempted, and the frontmatter serializer itself collapses embedded newlines to a space as defense in depth for any other caller.
