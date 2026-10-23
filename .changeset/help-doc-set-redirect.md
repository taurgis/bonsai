---
'@taurgis/bonsai': patch
---

Salesforce Help articles that moved to a new doc set now fetch instead of failing with `FETCH_FAILED`. Help redirects ids such as `sf.sso_about.htm` to `xcloud.sso_about.htm` (or `platform.…`); Bonsai now treats that as the same article, while a redirect to a different article is still rejected.
