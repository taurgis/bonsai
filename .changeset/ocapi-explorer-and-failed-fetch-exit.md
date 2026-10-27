---
'@taurgis/bonsai': patch
---

OCAPI and SCAPI reference explorer pages on developer.salesforce.com (`…/references/ocapi-data-users?meta=Get%2BUser`, `…/commerce-api/references/shopper-baskets`) now capture the full operation reliably. Bonsai waits for the API spec the page renders from; before, a slow connection could store only the deprecation banner. If the spec fails to load, the fetch fails with `FETCH_FAILED`.

A page that reads as an error or "not found" shell now fails with `FETCH_FAILED` (exit 1) and is not cached. Before, Bonsai printed `Error: … could not be cached`, exited 0, and replayed that marker as a fresh cache hit. A refresh that hits an error page keeps the existing note (served stale within grace) instead of overwriting it. Error markers cached by older releases are re-fetched.
