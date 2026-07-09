---
"@taurgis/bonsai": patch
---

Fix headless Chrome's TLS handshake against the sandbox's egress proxy (e.g. Claude Code's remote sandbox) so `--rendered` and Salesforce fetches work there instead of failing with `ERR_CERT_AUTHORITY_INVALID`. Chrome's own TLS stack never reads `NODE_EXTRA_CA_CERTS`/`SSL_CERT_FILE`/`CURL_CA_BUNDLE` the way Node/curl/Python do, so it didn't trust the sandbox proxy's re-terminated TLS even though every other tool did; Chrome is now launched with `--ignore-certificate-errors-spki-list` pinned to that specific CA's SPKI hash (never `--ignore-certificate-errors`, which would disable verification for every host). Also caps Chrome's TLS version at 1.2 for the proxied path: some sandbox proxies' TLS terminator never responds to Chrome's default TLS 1.3 ClientHello and the connection is eventually reset. Both are no-ops outside a detected sandbox proxy, so ordinary developer machines are unaffected.
