---
"@taurgis/bonsai": patch
---

Fix developer.salesforce.com guide/API-reference captures leaking the entire left-hand navigation tree (`dx-sidebar-old`, hundreds of links) into the extracted Markdown, which pushed the real article content to the end and consumed most of the token budget in `compressed` output.
