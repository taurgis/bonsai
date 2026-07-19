---
"@taurgis/bonsai": patch
---

Close an SSRF gap where a public URL that redirects the automatic (or `--rendered`) browser-fallback capture into a private/internal address or a non-http(s) scheme (e.g. `file:`) was rendered by Chrome without the same per-hop DNS/scheme safety check the static fetcher enforces; such navigations now fail with the same "blocked local or private target" error. Also surface low-confidence extraction warnings (e.g. "extracted content is very short") on stderr for human-mode `fetch`, matching what was previously visible only via `--json`.
