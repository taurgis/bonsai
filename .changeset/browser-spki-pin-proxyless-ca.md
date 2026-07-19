---
"@taurgis/bonsai": patch
---

Fix `--rendered` browser-based fetches failing with `ERR_CERT_AUTHORITY_INVALID` in sandboxed environments that export a CA bundle env var (`NODE_EXTRA_CA_CERTS`/`SSL_CERT_FILE`/`CURL_CA_BUNDLE`) without also setting `HTTPS_PROXY`/`HTTP_PROXY`. Chrome's SPKI cert pinning now activates whenever a CA bundle is discoverable, independent of proxy detection.
