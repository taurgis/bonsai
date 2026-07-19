---
'@taurgis/bonsai': patch
---

Fetch help.salesforce.com articles via Salesforce's official b2c-developer-tooling Markdown mirror (`help-admin`/`help-merchant`) when a twin is available, replacing the ~45s browser render with one static request and recording `capture_method: route_markdown`. Falls back to the existing rendered capture when no twin validates. Extracted the shared Markdown-twin probe/validate logic (previously duplicated) into `src/sites/markdown-twin.ts`, also now used by the developer.salesforce.com twin.
