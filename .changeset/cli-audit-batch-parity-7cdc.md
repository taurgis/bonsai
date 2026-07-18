---
'@taurgis/bonsai': patch
---

Improve CLI recovery UX and contract gaps from the end-to-end audit, then collapse the implementation: shared CACHE_MISS copy, `enrichRowErrorEnvelope` for all multi-URL `.error` rows, shared `missingCommandDetails` / `cliErrorFields`, prune overlay in the envelope module, and leading `--read-only`/`--plan` relocation like `--json`.
