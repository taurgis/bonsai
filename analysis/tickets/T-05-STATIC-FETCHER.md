# T-05: Fetch Static HTML With Limits

## Goal

Fetch static HTML safely using Node's built-in fetch and strict resource limits.

## User Stories

- `US-04.1` static HTML fetch
- `US-05.3` conditional request support
- `US-07.2` bounded fetch
- `US-07.6` polite source behavior

## Depends On

- T-02

## Target Files

- `src/lib/research/fetcher.ts`
- `src/lib/research/url.ts`
- fetcher tests with local fake responses

## Scope

- Use global `fetch`.
- Use `AbortSignal.timeout`.
- Use a default timeout of `10_000` ms.
- Use a default response body limit of `2 MiB`.
- Follow at most `5` redirects.
- Revalidate every redirect target through the URL safety rules.
- Capture status, content type, ETag, Last-Modified, final URL, and response size.
- Support conditional request headers when validators exist.
- Reject non-HTML responses unless explicitly allowed later.

## Implementation Notes

- Use `redirect: "manual"` so each redirect target can be validated before following.
- Before every fetch, resolve the hostname with `node:dns/promises.lookup(hostname, { all: true })` and reject private/local resolved IPs using the T-02 IP checks.
- Read the response stream with a byte counter; abort once it exceeds `2 MiB`.
- Treat `text/html` and `application/xhtml+xml` as HTML.
- Treat missing content type as allowed only if the first bytes look like HTML.

## Out of Scope

- Browser rendering.
- Cookies or authenticated fetches.
- Request header persistence.
- Robots.txt parsing.

## Acceptance Criteria

- Slow responses time out.
- Oversized responses fail without writing a new artifact.
- Unsafe redirect targets are blocked.
- Hostnames resolving to private/local IPs are blocked.
- `304 Not Modified` can be represented without full body extraction.
- Existing cache artifacts are preserved on fetch failure.

## Validation

```bash
pnpm test -- --run src/lib/research
pnpm type-check
```
