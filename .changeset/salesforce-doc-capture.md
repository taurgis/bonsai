---
'@taurgis/bonsai': patch
---

Salesforce doc fetches follow atlas Markdown twins, including REST API books that now redirect under `/docs/platform`. Browser captures drop the release switcher and the "Open in ChatGPT" toolbar so the article is what gets stored. A document URL that is HTTP 404 fails immediately, and a page that swaps in a different article (such as a retired Apex topic landing on the book home) is rejected instead of stored under the requested URL.
