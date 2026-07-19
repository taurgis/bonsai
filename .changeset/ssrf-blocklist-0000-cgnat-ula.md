---
"@taurgis/bonsai": patch
---

Fix the SSRF IP blocklist so it actually blocks the ranges the troubleshooting docs already claimed were blocked: `0.0.0.0/8` (a well-known SSRF-filter bypass that many stacks route to the loopback interface), `100.64.0.0/10` (Shared Address Space / CGNAT), and IPv6 `fc00::/7` (Unique Local Addresses, IPv6's RFC1918 equivalent). Previously only loopback, RFC1918, and link-local ranges were rejected — a URL resolving to `0.0.0.0` or a ULA address reached `checkDnsSafety` and attempted a real network connection instead of failing closed.
