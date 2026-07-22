---
"@taurgis/bonsai": patch
---

Close a second terminal-escape-injection gap, this time in validation error text rather than cached content: raw ANSI/control bytes in a rejected `--ttl`/`--max-age`/`--older-than`/`--inactive`, an unknown `config` key or invalid value, an unparseable URL, or an unrecognized command replayed unstripped into the human-readable error message that echoes the value back for context. `BaseCommand.error()` now sanitizes the message and suggestions on the human-mode render path before handing off to oclif (the `command_not_found` hook and the argv-level "swallowed a URL as a flag value" usage error sanitize their own echoed value at the same point, since both fire before a command instance exists). `--json` output is untouched: `JSON.stringify` already escapes control characters, so the envelope keeps the value's exact fidelity.
