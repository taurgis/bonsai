---
"@taurgis/bonsai": patch
---

Exclude secret-shaped text (API keys, tokens, credential assignments) from auto-generated tags. Previously a secret embedded in imported or fetched content could surface as a literal tag, which is shown in plain text by `list`/`inspect` output even when the artifact body was correctly routed to the non-project cache.
