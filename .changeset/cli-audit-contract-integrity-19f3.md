---
"@taurgis/bonsai": patch
---

Align `--json` stream routing and fetch envelope command id (#73).

Under `--json`, empty-list tips and error text stay in the envelope only (no process-stderr mirror). Fetch reports `command: "fetch"` instead of the bin name.
