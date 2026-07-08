# @taurgis/bonsai

## 3.0.1

### Patch Changes

- d281df1: Fix the sandbox-proxy auto-detection so the plain-fetch path and the headless-Chrome path agree on which proxy to use and never hard-fail a request the proxy can't reach: matched env-var precedence and per-scheme routing between undici and Chrome, added a fallback to a direct connection when the proxy rejects the tunnel, stopped doing a local DNS lookup once a proxy is configured (the proxy resolves it), and improved the CLI's error guidance for proxy failures.
- 17579ac: Sanitize likely indirect prompt-injection instructions from fetched and imported documentation before presenting cached Markdown to agents.
- 43cc2b9: Automatically route requests through a configured HTTP(S) proxy (HTTPS_PROXY/HTTP_PROXY/NO_PROXY) when one is present, so sandboxed execution environments that block direct egress — including the headless-Chrome path used to fetch developer.salesforce.com and help.salesforce.com — can still fetch documentation.

## 3.0.0

### Major Changes

- 3782d89: Remove the `search` command, including local cache search, `--domain` site search, and `--remote` docs discovery. Agents should discover official URLs with native web/search tools and fetch pages directly through Bonsai. The shipped agent kit templates and docs are updated accordingly.
