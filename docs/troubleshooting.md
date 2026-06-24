# Troubleshooting & Limitations

This document lists the design limits, security blocklists, technical constraints, and common troubleshooting steps for Bonsai.

---

## 1. Network Constraints & Crawler Limits

To prevent infinite loops, resource exhaustion, and denial of service (DoS) attacks on both local and remote systems, the static HTML fetcher enforces several hard limits.

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

To prevent Server-Side Request Forgery (SSRF) attacks, the CLI intercepts all hostname resolutions before making a network request. It resolves the hostname to its underlying IP addresses (IPv4 and IPv6) and validates them against standard private and local IP blocks.

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
* **Attempting to crawl local dev servers**:
  * *Command*: `bonsai http://localhost:8080/`
  * *Error*: `Error: IP address "127.0.0.1" is a blocked local or private target.`
* **Resolution**: Local resources cannot be fetched directly using the automatic crawler. To import documentation from a local dev server, compile it to Markdown first and use the `import` command:
  ```bash
  curl -s http://localhost:8080/docs | bonsai import http://localhost:8080/docs --stdin
  ```

---

## 3. Client-Side Hydration (SPA) Limitations

Bonsai prioritizes light CPU/memory footprints and fast execution. It executes a **static HTML fetch** using Node's native fetch API and parses the response into a virtual DOM via `linkedom`.

### The Constraint
* **No Javascript Runtime**: The crawler **does not execute client-side JavaScript**. It cannot hydrate pages, click cookie consent banners, or wait for asynchronous API calls to render content.
* **Affected Sites**: Single-Page Applications (SPAs) built with React, Angular, Vue, Svelte, or Next.js/Nuxt.js that rely on client-side JS to render body text will return empty or incomplete content.
* **Symptoms**: The scraped Markdown output contains only `<div id="app"></div>`, loading spinners, or cookie consent banners, and lists an `extraction_confidence` of `low`.

### Workarounds
1. **Use Pre-Rendered / Server-Side Rendered (SSR) targets**: Most official documentation platforms (like Docusaurus, Nextra, or MkDocs) pre-render pages as static HTML. Target those instead of client-side-only portals.
2. **Manual CLI Import**: If you must research a JS-rendered page, open the page in a browser, copy the main article content (or convert it locally), and import it into the CLI database:
   ```bash
   bonsai import https://spa-docs.com/page --stdin < page.md
   ```

---

## 4. Exit Codes & Common Errors

Bonsai returns distinct exit codes depending on the result status to allow machine callers (like AI agents) to programmatically handle errors.

### Exit Code Directory

| Exit Code | Classification | Cause | Resolution |
| --- | --- | --- | --- |
| **`0`** | **Success** | Command completed successfully, or a valid cache hit was returned. | No action required. |
| **`1`** | **General Failure** | DNS block, network connection timeout, invalid hostname, SSL error, or HTTP status >= 400. | Check internet connection, verify the target URL, or ensure the host is public. |
| **`2`** | **Usage Error** | Invalid flags, missing positional arguments, or incorrect `--stdin` usage. | Check help output using `--help` flag. |
| **`5`** | **Offline Stale Warning** | Server is offline or unreachable, and the CLI served stale cache inside the grace window. | Revalidation failed but cache is within grace. Run with `--allow-stale` to suppress this warning and exit with `0`. |

### Troubleshooting Specific Scenarios

#### Scenario A: Fetch fails with HTTP 403 / 401
* **Cause**: Some documentation platforms block programmatic scraping using WAFs (like Cloudflare) or require authentication.
* **Resolution**: v1 of Bonsai does not support authenticated requests or session cookies. You must download the page details manually and use `import` to cache the notes.

#### Scenario B: Empty content returned
* **Cause**: The scraper parser uses `@mozilla/readability` to extract main article text. If a page has complex nested tables or does not contain a clean `<article>` or `<main>` layout, Readability may fail to detect the content body.
* **Resolution**: Check the metadata quality notes (`inspect <url>`). If the confidence is `low`, you can overwrite the cached scrape with a manual import of clean Markdown.
