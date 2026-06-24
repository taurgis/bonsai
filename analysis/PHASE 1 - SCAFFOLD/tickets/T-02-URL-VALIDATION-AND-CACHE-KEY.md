# T-02: Validate URLs and Derive Cache Keys

## Goal

Normalize source URLs safely and produce deterministic cache keys without adding utility dependencies.

## User Stories

- `US-02.2` URL and flag validation
- `US-03.1` deterministic cache key
- `US-07.1` unsafe URL rejection

## Depends On

- T-01

## Target Files

- `src/lib/research/url.ts`
- `src/lib/research/cache-key.ts`
- focused unit tests in the plugin package

## Scope

- Use the WHATWG `URL` API.
- Accept only `http:` and `https:`.
- Reject usernames and passwords in URLs.
- Strip fragments from normalized cache identity.
- Normalize host casing.
- Remove default ports.
- Preserve path trailing slashes exactly, except normalize an empty path to `/`.
- Preserve query parameters, but sort them by key and then value for cache identity.
- Preserve duplicate query parameters in sorted order.
- Hash key inputs with `node:crypto` SHA-256.
- Keep `topic`, `tags`, and requested `--format` out of the cache key.

## Normalization Examples

| Input | Normalized |
| --- | --- |
| `HTTPS://Example.com` | `https://example.com/` |
| `https://example.com:443/docs#install` | `https://example.com/docs` |
| `http://example.com:80/docs` | `http://example.com/docs` |
| `https://example.com/docs?b=2&a=1` | `https://example.com/docs?a=1&b=2` |
| `https://example.com/docs?a=2&a=1` | `https://example.com/docs?a=1&a=2` |
| `https://user:pass@example.com/docs` | reject |

## SSRF Safety Scope

Reject before fetch:

- localhost names
- hostnames ending in `.localhost`
- loopback IPv4 and IPv6
- RFC1918/private IPv4 ranges
- link-local addresses
- metadata IPs such as `169.254.169.254`

Use `node:net` `isIP` for literal IP checks. T-05 must also resolve hostnames with `node:dns/promises.lookup({ all: true })` before fetch and re-run these IP checks against every resolved address. Redirect targets must be revalidated the same way before following.

## Out of Scope

- DNS rebinding hardening beyond documented hostname/IP checks.
- Robots.txt.
- Browser rendering.

## Acceptance Criteria

- Equivalent URLs produce the same normalized URL and cache key.
- Meaningfully different URLs produce different keys.
- Unsafe schemes and local/private targets fail before any fetcher is called.
- URL normalization examples above are covered by tests.
- Cache keys contain no raw URL path text usable for path traversal.
- Errors map to existing usage or failure exit code conventions.

## Validation

```bash
pnpm test -- --run src/lib/research
pnpm test:contract
pnpm type-check
```
