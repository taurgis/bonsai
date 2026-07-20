# @taurgis/bonsai

## 3.2.2

### Patch Changes

- 01530d1: Fix `bonsai example.com example.org` (a scheme-less multi-URL batch-fetch typo) reporting a bare `COMMAND_NOT_FOUND` with no guidance. A single scheme-less URL already got a helpful "Did you mean `bonsai https://example.com`?" hint, but oclif folds multiple positional args into one colon-joined id before this CLI ever sees them, and that joined string fails to parse as a single URL (the colon between two hostnames reads as an invalid port) — so the hint silently stopped working for exactly the batch-fetch case it's most likely to matter for. Each folded segment is now checked individually, so this case now reports `MISSING_URL_SCHEME` with a corrected multi-URL command.
- ee72bcc: Fix `--rendered` browser-based fetches failing with `ERR_CERT_AUTHORITY_INVALID` in sandboxed environments that export a CA bundle env var (`NODE_EXTRA_CA_CERTS`/`SSL_CERT_FILE`/`CURL_CA_BUNDLE`) without also setting `HTTPS_PROXY`/`HTTP_PROXY`. Chrome's SPKI cert pinning now activates whenever a CA bundle is discoverable, independent of proxy detection.
- 73d17ee: Fix three CLI audit findings:

  - **Content-type integrity**: a non-HTML response (JSON, PDF, binary) rejected by the static
    fetcher no longer silently retries through the automatic rendered-browser fallback. A browser can
    still render _something_ for those (e.g. Chrome's built-in JSON viewer), which previously got
    cached as a high-confidence "extracted" artifact instead of surfacing the real content-type
    error. `--rendered` still bypasses this entirely, so an informed retry remains available.
  - **Prompt-injection sanitization**: the redaction patterns previously only matched a harmful
    instruction at the exact start of a line or right after a handful of role-address words, so any
    filler text placed before the instruction ("Heads up: ignore previous instructions...") bypassed
    detection entirely. Detection now anchors per clause (split on sentence-ending punctuation), so a
    command hidden behind an innocuous opener is still caught, while legitimate documentation that
    merely describes an attack (e.g. "An attacker may tell the model to ignore...") is still left
    untouched.
  - **Multi-source note discoverability**: `inspect` on a URL that has no cache entry of its own but
    is already a `--source-url` of an existing multi-source `research_note` no longer suggests a
    plain fetch (which would create an unrelated duplicate entry). The miss now reports
    `partOfExistingNote` in `--json` output and points at `bonsai list --url "<url>"` to find the
    existing note.

- 80ee19b: Align `--json` stream routing and fetch envelope command id (#73).

  Under `--json`, empty-list tips and error text stay in the envelope only (no process-stderr mirror). Fetch reports `command: "fetch"` instead of the bin name.

- fd1ca90: Honor read-only/plan mode for derived search-index sidecar writes: `list` and `inspect` no longer create `.search-index.json` when `--read-only`/`--plan` or `BONSAI_READ_ONLY`/`BONSAI_PLAN_MODE` is active.
- b1e3765: Sanitize prompt-injection text in Salesforce site-module browser captures, matching the shared HTML/Markdown extraction path so hostile pages cannot skip the safeguard.
- fafb493: Close an SSRF gap where a public URL that redirects the automatic (or `--rendered`) browser-fallback capture into a private/internal address or a non-http(s) scheme (e.g. `file:`) was rendered by Chrome without the same per-hop DNS/scheme safety check the static fetcher enforces; such navigations now fail with the same "blocked local or private target" error. Also surface low-confidence extraction warnings (e.g. "extracted content is very short") on stderr for human-mode `fetch`, matching what was previously visible only via `--json`.
- 0bb6d99: Fetch help.salesforce.com articles via Salesforce's official b2c-developer-tooling Markdown mirror (`help-admin`/`help-merchant`) when a twin is available, replacing the ~45s browser render with one static request and recording `capture_method: route_markdown`. Falls back to the existing rendered capture when no twin validates. Extracted the shared Markdown-twin probe/validate logic (previously duplicated) into `src/sites/markdown-twin.ts`, also now used by the developer.salesforce.com twin.
- 00d4454: Surface a machine-readable `truncation` object on the `list --json` envelope when `--limit` caps results, so agents can detect partial listings without scraping stderr.
- 8fcb0a6: Fix `prune --dry-run --json` falsely reporting `PRUNE_PARTIAL_FAILURE`.

  `prune --dry-run` never deletes anything, so `prunedCount` is always `0` by design. The JSON envelope enrichment compared `prunedCount` against `candidateCount` without checking `dryRun`, so any dry-run preview with one or more matching candidates reported `ok: false`, `exitCode: 1`, and a fabricated "Failed to delete N cache entries" error — even though the actual process exit code was `0` and nothing was touched. Dry-run previews now always report a clean success envelope.

- b3745fe: Scan and redirect secret-bearing content on in-place cache revalidation the same way as first-time project writes, and clear any leftover project copy so it cannot shadow the global redirect.
- 206ff7d: Exclude secret-shaped text (API keys, tokens, credential assignments) from auto-generated tags. Previously a secret embedded in imported or fetched content could surface as a literal tag, which is shown in plain text by `list`/`inspect` output even when the artifact body was correctly routed to the non-project cache.
- 01530d1: Fix the SSRF IP blocklist so it actually blocks the ranges the troubleshooting docs already claimed were blocked: `0.0.0.0/8` (a well-known SSRF-filter bypass that many stacks route to the loopback interface), `100.64.0.0/10` (Shared Address Space / CGNAT), and IPv6 `fc00::/7` (Unique Local Addresses, IPv6's RFC1918 equivalent). Previously only loopback, RFC1918, and link-local ranges were rejected — a URL resolving to `0.0.0.0` or a ULA address reached `checkDnsSafety` and attempted a real network connection instead of failing closed.

## 3.2.1

### Patch Changes

- 19fc340: Improve CLI recovery UX from the end-to-end audit, then collapse incidental complexity: shared CACHE_MISS copy and sparse `urlValidationErrorRow`, composed read overlays, argv `earlyExit` as the single owner of flag-only `MISSING_COMMAND` (including swallowed-URL tips — no dash-id branch in `command_not_found`), and prune partial-failure shaping in the envelope module.
- a49fd22: Fix CLI contract and UX gaps found in a full happy/unhappy-path audit: `-l` before URL shorthand, localhost cache keys, status `--tier`, prune filter semantics, inspect multi-URL payloads, and stable `MISSING_COMMAND` / suggestion envelopes.
- b526e09: Fix CLI contract and UX gaps from an end-to-end audit, then restructure the implementation: shared config entry resolution, shared argv/error-envelope helpers, prune flag policy as a pure function, URL-filter validation in its canonical module, and a simpler empty-list tip path.
- 469473e: Improve CLI recovery UX from the end-to-end audit: unwrap oclif `Parsing --flag` error wrappers, suggest nearest flags/enum values on typos (including truncated freshness values), tip that `list` omits section artifacts, suggest the URL shorthand for `fetch` typos, surface the `--plan` alias in `--read-only` help, make multi-source `import` return `sourceUrls`/`topic` with null primary URLs instead of empty strings, and keep prior fetch hits in multi-URL batches when a later URL is invalid or missing its scheme.
- c5840f1: Document the final CLI audit behavior for read-only config previews and import input limits, and extend the living audit to cover remaining command-surface gaps.
- 169cece: Stabilize the agent-facing error contract by documenting stable error codes, preserving human error text on stderr under `--json`, and adding suggestions to recoverable failures.
- 7958a28: Unify CLI help copy, align TTL examples, and document intentional command asymmetries.
- 0896799: Make read-only, plan, and dry-run previews more trustworthy across write commands: fetch now reports would-be secret redirects without writing, config set/unset expose would\_\* preview statuses, and prune reports would-prune counts in JSON output.
- 74f9e28: Follow-up CLI structural cleanup: split emit build vs write/exit, invert argv flag ownership via a composition-root manifest, move write-status helpers out of research persist, share config set/unset persist, extract fetch/import application services, and type list/prune/inspect row models.
- 97a6a7a: Refactor CLI internals for maintainability: shared error emit/policy, derived argv value-flags, artifact persist helpers, and shared status/inspect cache headers — no intentional user-facing behavior change.
- 24db008: Harden CLI argv/help contracts by keeping value-taking flag normalization synced with command definitions and auditing aligned list/prune/config JSON surfaces.
- 7a89721: Document the `--read-only`/`--plan` mode in the shipped agent templates — the Official Docs Researcher and Salesforce Docs Researcher agents, the web-research skill, and both research instructions files — so agents invoking Bonsai under a read-only/plan-mode harness know the flag and env vars exist. Bumps each template's `metadata.version`.
- 54f8c51: Document inspect/status parity fixes for agent-facing batch and JSON envelope behavior: multi-URL
  `inspect` now preserves successful rows alongside cache misses or URL validation failures while
  surfacing stable top-level `code`, `exitCode`, `data`, and suggestions in the same shape as
  `status`.

## 3.2.0

### Minor Changes

- 6fd378b: Add a global `--read-only` flag (alias `--plan`), also honored via the `BONSAI_READ_ONLY`/`BONSAI_PLAN_MODE` environment variables, that blocks every command's filesystem writes and deletes (cache persistence, config writes, `prune` deletions) while still allowing network fetches to run. This lets agent harnesses that enter a read-only "plan mode" keep using Bonsai for research without it writing to disk: set the env var once per session and every invocation honors it automatically.

## 3.1.0

### Minor Changes

- afc7491: Prefer Salesforce Developer "View as Markdown" routes over browser rendering. Supported developer.salesforce.com articles publish a Markdown twin at a deterministic `.md` URL; the Salesforce Developer site module now derives and probes that route first, validates it strictly (markdown content type, https same-host redirects, non-HTML body, minimum article length), and only falls back to the shadow-DOM browser capture when no twin exists. Artifacts record `capture_method: route_markdown` and the `.md` URL in `source_doc_url`, and revalidation refreshes that provenance in both directions — a withdrawn twin can no longer leave a stale `.md` source recorded. The browser path also strips the new "Copy/View as Markdown" toolbar labels from captured content.

  Fixed alongside, for all Markdown-source captures (MDN, Node.js, VitePress routes, GitHub sources): sanitization and section/link cleanup are now fence-aware, so code samples no longer lose `<script>`/`<button>` lines, inline event handlers, `javascript:` URLs, bash `#` comments, or literal `[](…)` lines that happened to sit inside fenced code. The regression suite's table metric now also counts source-authored separator rows of any width/alignment.

## 3.0.3

### Patch Changes

- e06d067: Fix developer.salesforce.com guide/API-reference captures leaking the entire left-hand navigation tree (`dx-sidebar-old`, hundreds of links) into the extracted Markdown, which pushed the real article content to the end and consumed most of the token budget in `compressed` output.

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
