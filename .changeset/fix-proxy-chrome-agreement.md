---
"@taurgis/bonsai": patch
---

Fix the sandbox-proxy auto-detection so the plain-fetch path and the headless-Chrome path agree on which proxy to use and never hard-fail a request the proxy can't reach: matched env-var precedence and per-scheme routing between undici and Chrome, added a fallback to a direct connection when the proxy rejects the tunnel, stopped doing a local DNS lookup once a proxy is configured (the proxy resolves it), and improved the CLI's error guidance for proxy failures.
