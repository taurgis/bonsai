# Cache pages you can't fetch

Bonsai's automatic fetcher does a plain HTTP GET and reads the static HTML. Some
pages defeat that: they sit behind a login, get blocked by a WAF, render entirely
in client-side JavaScript, or live on `localhost` (which the SSRF guard refuses).
You can still get any of them into the cache — you supply the Markdown, and
[`import`](/how-to/importing-synthesis) stores it under the same rules as a fetch.

## First, recognize the symptom

You need this workflow when a normal fetch returns too little:

| What you see | Likely cause |
| --- | --- |
| HTTP `401` / `403` | Login required, or a WAF (e.g. Cloudflare) blocking scrapers. |
| Almost-empty output, `extraction_confidence: low` | A single-page app that renders body text in the browser. |
| `IP address … is a blocked local or private target` | A `localhost` or private-network URL the SSRF guard rejects. |

Check confidence after a fetch with `inspect`:

```bash
npx @taurgis/bonsai inspect https://spa-docs.example.com/guide
```

A `low` confidence with a tiny body is the tell that the static fetch came up
short.

## Try `--rendered` first (SPA pages only)

Before importing by hand, give the browser path a chance. For a JavaScript-rendered
page, `--rendered` runs a headless browser so the content hydrates before
extraction:

```bash
npx @taurgis/bonsai https://spa-docs.example.com/guide --rendered
```

If that returns the real article, you're done. `--rendered` does **not** help with
auth or WAF blocks — there's no session or login — so for those, import.

## Import the content yourself

Get the clean Markdown however you can: copy the rendered article from your
browser, export it, or convert a local file. Then pipe it to `import` under the
URL it belongs to.

### From a file

```bash
npx @taurgis/bonsai import https://docs.example.com/private-page --file ./page.md
```

### From stdin (including a local dev server)

The SSRF guard blocks Bonsai from fetching `localhost`, but nothing stops *you*
from fetching it and piping the result in:

```bash
curl -s http://localhost:8080/docs | \
  npx @taurgis/bonsai import http://localhost:8080/docs --stdin
```

Because the cache key matches the URL, a later `bonsai http://localhost:8080/docs`
serves your imported copy. Input is capped at 1 MiB, and empty input is rejected
so a failed upstream step can't cache a blank note.

## Confirm it landed

```bash
npx @taurgis/bonsai status https://docs.example.com/private-page
```

A `Status: hit` with `Action: would_return_cached` means the page is now served
from the cache like any fetched page. It also shows up in
[`search`](/how-to/search).

## Keeping imported notes fresh

An imported note has no remote page to revalidate against, so it expires purely
on its tier or TTL. Pick a `--tier` (or `--ttl`) that matches how long the
content stays true:

```bash
curl -s http://localhost:8080/docs | \
  npx @taurgis/bonsai import http://localhost:8080/docs --stdin --tier volatile
```

For the full set of import options — multi-source synthesis, tags, storage
routing — see [Import synthesized research](/how-to/importing-synthesis). For the
exact fetcher limits behind these symptoms, see [Troubleshooting & Limits](/troubleshooting).
