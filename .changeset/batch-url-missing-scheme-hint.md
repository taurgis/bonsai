---
"@taurgis/bonsai": patch
---

Fix `bonsai example.com example.org` (a scheme-less multi-URL batch-fetch typo) reporting a bare `COMMAND_NOT_FOUND` with no guidance. A single scheme-less URL already got a helpful "Did you mean `bonsai https://example.com`?" hint, but oclif folds multiple positional args into one colon-joined id before this CLI ever sees them, and that joined string fails to parse as a single URL (the colon between two hostnames reads as an invalid port) — so the hint silently stopped working for exactly the batch-fetch case it's most likely to matter for. Each folded segment is now checked individually, so this case now reports `MISSING_URL_SCHEME` with a corrected multi-URL command.
