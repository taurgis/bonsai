---
'@taurgis/bonsai': minor
---

Prefer Salesforce Developer "View as Markdown" routes over browser rendering. Supported developer.salesforce.com articles publish a Markdown twin at a deterministic `.md` URL; the Salesforce Developer site module now derives and probes that route first, validates it strictly (markdown content type, same-host redirects, non-HTML body), and only falls back to the shadow-DOM browser capture when no twin exists. Artifacts captured this way record `capture_method: route_markdown` and the `.md` URL in `source_doc_url` — including on revalidation. The browser path also strips the new "Copy/View as Markdown" toolbar labels from captured content.
