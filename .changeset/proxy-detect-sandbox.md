---
"@taurgis/bonsai": patch
---

Automatically route requests through a configured HTTP(S) proxy (HTTPS_PROXY/HTTP_PROXY/NO_PROXY) when one is present, so sandboxed execution environments that block direct egress — including the headless-Chrome path used to fetch developer.salesforce.com and help.salesforce.com — can still fetch documentation.
