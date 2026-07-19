---
"@taurgis/bonsai": patch
---

Scan and redirect secret-bearing content on in-place cache revalidation the same way as first-time project writes, and clear any leftover project copy so it cannot shadow the global redirect.
