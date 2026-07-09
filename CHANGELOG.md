# @taurgis/bonsai

## 3.0.2

### Patch Changes

- 60e8ca0: Fix headless Chrome's TLS handshake against the sandbox's egress proxy (e.g. Claude Code's remote sandbox) so `--rendered` and Salesforce fetches work there instead of failing with `ERR_CERT_AUTHORITY_INVALID`. Chrome's own TLS stack never reads `NODE_EXTRA_CA_CERTS`/`SSL_CERT_FILE`/`CURL_CA_BUNDLE` the way Node/curl/Python do, so it didn't trust the sandbox proxy's re-terminated TLS even though every other tool did; Chrome is now launched with `--ignore-certificate-errors-spki-list` pinned to that specific CA's SPKI hash (never `--ignore-certificate-errors`, which would disable verification for every host). Also caps Chrome's TLS version at 1.2 for the proxied path: some sandbox proxies' TLS terminator never responds to Chrome's default TLS 1.3 ClientHello and the connection is eventually reset. Both are no-ops outside a detected sandbox proxy, so ordinary developer machines are unaffected.
- 212e25c: Auto-detect the Playwright-provisioned Chromium under `PLAYWRIGHT_BROWSERS_PATH` (e.g. Claude Code's remote sandbox) so `--rendered` and Salesforce fetches work there without a manual `CHROME_PATH`. Also fix a bug where a failed Chrome navigation (network/proxy failure) went unchecked in the Salesforce doc fetcher, letting Chrome's own "site can't be reached" interstitial be captured and cached as if it were real article content; both the Salesforce fetcher and the generic `--rendered` path now fail with a clear, specific error instead — naming the blocked host and the sandbox network gateway as the likely cause — rather than a generic Chrome net-error code or a silently wrong result.

## 3.0.1

### Patch Changes

- d281df1: Fix the sandbox-proxy auto-detection so the plain-fetch path and the headless-Chrome path agree on which proxy to use and never hard-fail a request the proxy can't reach: matched env-var precedence and per-scheme routing between undici and Chrome, added a fallback to a direct connection when the proxy rejects the tunnel, stopped doing a local DNS lookup once a proxy is configured (the proxy resolves it), and improved the CLI's error guidance for proxy failures.
- 17579ac: Sanitize likely indirect prompt-injection instructions from fetched and imported documentation before presenting cached Markdown to agents.
- 43cc2b9: Automatically route requests through a configured HTTP(S) proxy (HTTPS_PROXY/HTTP_PROXY/NO_PROXY) when one is present, so sandboxed execution environments that block direct egress — including the headless-Chrome path used to fetch developer.salesforce.com and help.salesforce.com — can still fetch documentation.

## 3.0.0

### Major Changes

- 3782d89: Remove the `search` command, including local cache search, `--domain` site search, and `--remote` docs discovery. Agents should discover official URLs with native web/search tools and fetch pages directly through Bonsai. The shipped agent kit templates and docs are updated accordingly.
