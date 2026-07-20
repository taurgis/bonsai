---
"@taurgis/bonsai": patch
---

Close a terminal-escape-injection gap: raw ANSI/control bytes embedded in a fetched or imported page's visible text (or in an agent-supplied `--topic`, or in a page's Markdown headings used for section chunking) survived untouched into cached content and metadata, then replayed verbatim to the terminal on every later `bonsai <url>`, `list`, `inspect`, or `prune --dry-run`. Fetched/imported content is now stripped of unsafe control bytes at the same choke point that already redacts embedded prompt-injection instructions (`sanitizePromptInjection`), and human-readable `topic`/section-heading rendering strips them again at display time as defense in depth. `--json` output was never affected (`JSON.stringify` already escapes control characters).
