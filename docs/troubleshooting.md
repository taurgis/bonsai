# Troubleshooting & Limitations

Bonsai's design limits, security blocklists, and known constraints, plus what to do when a fetch goes wrong.

---

## 1. Network Constraints & Crawler Limits

The static HTML fetcher enforces a few hard limits. They keep a single fetch from looping forever, exhausting memory, or being turned into a denial-of-service vector against a remote host.

### Crawler Limits
* **Response Body Size Limit**: **2 MiB** (`2,097,152` bytes).
  * *Behavior*: If the remote page body exceeds this size before completing, the download is aborted immediately.
  * *Error Message*: `Response body size limit exceeded. Limit is 2097152 bytes.`
* **Connection / Request Timeout**: **10 Seconds** (`10,000` ms).
  * *Behavior*: If the server fails to respond within this timeframe, the fetch is aborted.
  * *Error Message*: `The user aborted a request.` (or network timeout).
* **Redirect Limit**: **5 Redirects**.
  * *Behavior*: The static fetcher manually follows HTTP location redirects (301, 302, 303, 307, 308). If a URL redirects more than 5 times, it throws an error to prevent circular redirect loops.
  * *Error Message*: `Too many redirects. Exceeded limit of 5.`

---

## 2. DNS Safety & Private IP Blocklist (SSRF Protection)

To guard against Server-Side Request Forgery (SSRF), the CLI intercepts hostname resolution before any network request goes out. It resolves the hostname to its IPv4 and IPv6 addresses and checks each one against the standard private and local IP blocks.

### Blocked Target Blocks (RFC1918 & Localhost)
The crawler will block the request if the resolved IP falls within any of the following blocks:
* **IPv4 Blocks**:
  * `127.0.0.0/8` (Loopback / Localhost)
  * `10.0.0.0/8` (Private Network)
  * `172.16.0.0/12` (Private Network)
  * `192.168.0.0/16` (Private Network)
  * `169.254.0.0/16` (Link-Local / Link-Local Metadata Services)
  * `0.0.0.0/32` (Broadcast)
* **IPv6 Blocks**:
  * `::1/128` (Loopback / Localhost)
  * `fc00::/7` (Unique Local Addresses)
  * `fe80::/10` (Link-Local)
  * `::/128` (Unspecified)

### Common Failure Symptoms
* **Attempting to crawl local dev servers on a cache miss**:
  * *Command*: `bonsai http://localhost:8080/`
  * *Error*: `Error: IP address "127.0.0.1" is a blocked local or private target.` (exit `1`, code `FETCH_FAILED`)
* **Resolution**: Localhost URLs are valid **cache keys**. Import Markdown under the local URL, then a later `bonsai http://localhost:8080/docs` serves the cached note without opening a socket. Network fetches to private/local targets remain blocked:
  ```bash
  curl -s http://localhost:8080/docs | bonsai import http://localhost:8080/docs --stdin
  bonsai http://localhost:8080/docs   # cache hit
  ```

---

## 3. Client-Side Hydration (SPA) Limitations

By default Bonsai does a **static HTML fetch** with Node's native fetch API, then parses the response into a virtual DOM with `linkedom`. That path does not execute client-side JavaScript.

### The Constraint
* **Static path has no JS runtime**: Without `--rendered`, the crawler cannot hydrate pages, click cookie consent banners, or wait for asynchronous API calls to render content.
* **Affected Sites**: Single-Page Applications (SPAs) built with React, Angular, Vue, Svelte, or Next.js/Nuxt.js that rely on client-side JS to render body text will return empty or incomplete content on a static fetch.
* **Symptoms**: The scraped Markdown output contains only `<div id="app"></div>`, loading spinners, or cookie consent banners, and lists an `extraction_confidence` of `low`.

### Workarounds
1. **Try `--rendered` first**: launches headless Chrome so the page hydrates before extraction (`bonsai <url> --rendered`). Requires Chrome/Chromium locally (or `CHROME_PATH`).
2. **Use Pre-Rendered / Server-Side Rendered (SSR) targets**: Most official documentation platforms (like Docusaurus, Nextra, or MkDocs) pre-render pages as static HTML.
3. **Manual CLI Import**: If auth/WAF blocks scraping, or `--rendered` is unavailable, copy the article and import it:
   ```bash
   bonsai import https://spa-docs.com/page --stdin < page.md
   ```

---

## 4. Exit Codes & Common Errors

Bonsai returns a distinct exit code for each result status, so a machine caller such as an AI agent can branch on the outcome without parsing output. Prefer the stable `code` field in `--json` envelopes over exit codes alone when multiple outcomes share an exit.

### Exit Code Directory

| Exit Code | Classification | Cause | Resolution |
| --- | --- | --- | --- |
| **`0`** | **Success** | Command completed successfully, or a valid cache hit was returned. | No action required. |
| **`1`** | **Runtime / data outcome** | A network or server failure after validation (`FETCH_FAILED`), a cache miss on `status`/`inspect` (`CACHE_MISS` — `data` still present), a multi-URL batch that kept prior hits when a later URL failed validation (`INVALID_URL` / `MISSING_URL_SCHEME` — `data` still present), or a partial `prune` unlink failure (`PRUNE_PARTIAL_FAILURE`). | Branch on the JSON `code`. For `CACHE_MISS`, fetch/import the URL first. For network failures, check connectivity or import manually. For `PRUNE_PARTIAL_FAILURE`, inspect permissions on the remaining `files` paths. |
| **`2`** | **Usage Error** | Invalid input rejected before any network call: an unknown command or typo (Bonsai prints the nearest matching command when one is close), invalid flags, missing positional arguments (`MISSING_COMMAND` when argv is only flags — bare `--json`, `--read-only`, or a value flag that swallowed the URL), incorrect `--stdin`/`--file` usage, an empty duration (`--ttl ''`), or a rejected URL on a single-URL invocation (malformed or a non-`http(s)` scheme). | Check help output using `--help`, and confirm the command name and that the URL is a full `http(s)` address. |
| **`5`** | **Offline Stale Warning** | Server is offline or unreachable, and the CLI served stale cache inside the grace window. | Revalidation failed but cache is within grace. Run with `--allow-stale` to suppress this warning and exit with `0`. |

### Troubleshooting Specific Scenarios

#### Scenario A: Fetch fails with HTTP 403 / 401
* **Cause**: Some documentation platforms block programmatic scraping using WAFs (like Cloudflare) or require authentication.
* **Resolution**: v1 of Bonsai does not support authenticated requests or session cookies. You must download the page details manually and use `import` to cache the notes.

#### Scenario B: Empty content returned
* **Cause**: The scraper parser uses `@mozilla/readability` to extract main article text. If a page has complex nested tables or does not contain a clean `<article>` or `<main>` layout, Readability may fail to detect the content body.
* **Resolution**: Check the metadata quality notes (`inspect <url>`). If the confidence is `low`, you can overwrite the cached scrape with a manual import of clean Markdown.

#### Scenario C: Scheme-less URL rejected across commands
* **Cause**: Every URL-accepting command (`bonsai <url>`, `status`, `inspect`, `import`) requires a full `http://` or `https://` scheme. When a domain-shaped input is given without one (e.g. `bonsai status docs.nestjs.com`), Bonsai detects the domain shape, exits `2`, and suggests the corrected URL. Unrecognizable junk (e.g. `notaurl`) gets a generic "Could not parse" message instead.
* **Resolution**: Add the scheme:
  ```bash
  bonsai https://example.com
  bonsai status https://docs.nestjs.com
  ```
