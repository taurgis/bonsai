---
"@taurgis/bonsai": patch
---

Surface a machine-readable `truncation` object on the `list --json` envelope when `--limit` caps results, so agents can detect partial listings without scraping stderr.
