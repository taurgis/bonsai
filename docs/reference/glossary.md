# Glossary

The terms Bonsai's documentation leans on, defined once. Where a concept has its
own page, the entry links to it.

### Artifact

One cached item: a single Markdown file with a YAML frontmatter header. Every
fetch or import produces exactly one artifact.

### Artifact type

What an artifact represents. A **`source`** artifact is a single page (fetched or
imported for one URL). A **`research_note`** is a synthesis keyed by a topic and
a set of source URLs rather than a single page. An **`index`** is a navigation
hub or llms.txt site index. A **`section`** is a heading-level child extracted
from a page. See [Import synthesized research](/how-to/importing-synthesis).

### Cache key

The SHA-256 hash of an artifact's [normalized URL](#normalized-url) (for a
synthesis, a hash of its topic and sorted sources). The key is the artifact's
filename and the reason two slightly different URLs reuse the same entry.

### Capture method

How the content was obtained: `static_fetch` (plain HTTP GET, the default),
`browser_fallback` (rendered in a headless browser, used for `--rendered` and
some [site modules](/reference/site-modules)), `agent_supplied` (handed in via
[`import`](/how-to/importing-synthesis)), `route_markdown` (the page's
machine-readable `.md` route, when one is published), or `github_source` (raw
source fetched from the page's GitHub edit link).

### Compressed vs. detailed

The two variants stored for every artifact. **`compressed`** is pruned to fit a
tight context window; **`detailed`** keeps the full content. One fetch produces
both. Pick one with `--format`. See [Compression](/concepts/compression).

### Conditional request

A revalidation request that sends the stored `ETag` or `Last-Modified` so the
server can answer `304 Not Modified` without resending the body. This is what
makes refreshing a stale entry cheap. See [Caching & Freshness](/concepts/caching-and-freshness#revalidation-cheap-before-expensive).

### Extraction confidence

How sure Bonsai is that it captured the real article: `high`, `medium`, or `low`.
A `low` value usually means the page rendered client-side or lacked a clean
article structure. See [Troubleshooting](/troubleshooting#3-client-side-hydration-spa-limitations).

### Freshness

The state of an entry relative to its tier or TTL, computed at lookup time:
`fresh`, `stale_grace` (past fresh but inside the grace window), or
`stale_expired` (past the grace window). See [Caching & Freshness](/concepts/caching-and-freshness#freshness-tiers).

### Grace window

The period after an entry stops being fresh during which Bonsai tries a cheap
[conditional request](#conditional-request) before a full refetch. Each tier sets
its own grace window.

### Normalized URL

A canonical form of the requested URL — lowercased scheme and host, sorted query
parameters, no fragment, default ports stripped — computed before hashing so
equivalent URLs map to one [cache key](#cache-key). See [Caching & Freshness](/concepts/caching-and-freshness#how-entries-are-keyed).

### Revalidation

Checking whether a stale entry is still current using a [conditional request](#conditional-request),
rather than downloading the page again.

### Site module

A small per-domain plug-in that overrides parts of the fetch or search pipeline
for a site that needs special handling (such as JavaScript-rendered pages). See
[Site Modules](/reference/site-modules).

### Storage mode

Where the cache lives: **`global`** (machine-wide, the default) or **`project`**
(committed under `.bonsai/research/` in a repo). See [Storage Modes](/concepts/storage-modes).

### Summary aggressiveness

How hard prose is condensed when structural compression alone leaves `compressed`
close to `detailed`: `conservative` (default), `balanced`, or `aggressive`.
Headings, code, tables, and lists are never condensed. See [Compression](/concepts/compression#summary-aggressiveness).

### Tier

A freshness preset that sets the fresh and grace windows: `volatile` (short),
`standard` (default), or `stable` (long). Override the exact window with a
[TTL](#ttl). See [Caching & Freshness](/concepts/caching-and-freshness#freshness-tiers).

### Token estimate

An approximate token count (`≈ chars / 4`) stored per variant, so an agent can
choose `compressed` or `detailed` against its budget.

### TTL

A custom freshness window (`--ttl 2h`, `7d`, `30d`) that replaces the tier's
fresh window. The grace window is then derived proportionally from the active
tier. See [Caching & Freshness](/concepts/caching-and-freshness#custom-ttls).
