---
"@taurgis/bonsai": patch
---

Make read-only, plan, and dry-run previews more trustworthy across write commands: fetch now reports would-be secret redirects without writing, config set/unset expose would_* preview statuses, and prune reports would-prune counts in JSON output.
