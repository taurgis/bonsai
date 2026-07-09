---
'@taurgis/bonsai': minor
---

Prefer Salesforce Developer "View as Markdown" routes over browser rendering. Supported developer.salesforce.com articles publish a Markdown twin at a deterministic `.md` URL; the Salesforce Developer site module now derives and probes that route first, validates it strictly (markdown content type, https same-host redirects, non-HTML body, minimum article length), and only falls back to the shadow-DOM browser capture when no twin exists. Artifacts record `capture_method: route_markdown` and the `.md` URL in `source_doc_url`, and revalidation refreshes that provenance in both directions — a withdrawn twin can no longer leave a stale `.md` source recorded. The browser path also strips the new "Copy/View as Markdown" toolbar labels from captured content.

Fixed alongside, for all Markdown-source captures (MDN, Node.js, VitePress routes, GitHub sources): sanitization and section/link cleanup are now fence-aware, so code samples no longer lose `<script>`/`<button>` lines, inline event handlers, `javascript:` URLs, bash `#` comments, or literal `[](…)` lines that happened to sit inside fenced code. The regression suite's table metric now also counts source-authored separator rows of any width/alignment.
