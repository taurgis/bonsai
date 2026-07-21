---
"@taurgis/bonsai": patch
---

Manual CLI audit fix: a config file (`config.json` or `.bonsai.json`) that is not valid JSON, or holds an invalid value for a known key, was silently ignored during resolution — the CLI fell back to the built-in default with no signal, unlike an invalid `BONSAI_STORAGE`/`BONSAI_SUMMARY` env var, which already warns. Bonsai now prints the same kind of warning to stderr (never stdout, so `--json` output is unaffected) naming the file and, when applicable, the offending key and value.
