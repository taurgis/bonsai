# Caching & Freshness

Bonsai is cache-first: it decides what to do *before* touching the network. This
page explains how entries are keyed, when they count as fresh, and how stale
entries are revalidated cheaply. For the full byte-level specification, see the
[Cache Protocol](/reference/cache-protocol).

## How entries are keyed

Every requested URL is **normalized** before its cache key is computed, so
slightly different URLs map to the same entry:

- Scheme and host are lowercased.
- A trailing slash is added to root paths (`https://example.com` → `https://example.com/`).
- Fragments (`#section`) are removed.
- Query parameters are sorted lexicographically.
- Default ports (80, 443) are stripped.

The cache key is the **SHA-256 hash** of the normalized URL. Each entry is a
single Markdown file (`<cache_key>.md`) with a YAML frontmatter header.

## Where the cache lives

| Storage | Location |
| --- | --- |
| **Global** (default) | macOS `~/Library/Application Support/bonsai/research/` · Linux `~/.local/share/bonsai/research/` · Windows `%LOCALAPPDATA%\bonsai\research\` |
| **Project** | `<project>/.bonsai/research/` (config in `.bonsai.json`) |

See [Storage Modes](/concepts/storage-modes) for choosing between them.

## Freshness tiers

If no custom `--ttl` is supplied, the freshness window comes from the `--tier`:

| Tier | Fresh window | Grace window | Use case |
| --- | --- | --- | --- |
| `volatile` | 7 days | 5 days | Latest releases, volatile changelogs, beta docs |
| `standard` | 30 days | 14 days | General API docs and developer guides |
| `stable` | 180 days | 60 days | RFCs, standards, long-lived references |

Freshness is computed at lookup time by comparing the current time against
`validated_at` (or `fetched_at`, whichever is more recent).

### Custom TTLs

Pass `--ttl` (e.g. `2h`, `7d`, `30d`) to set the fresh window exactly. The grace
window is then derived **proportionally** from the active tier's grace-to-fresh
ratio. For the default `standard` tier that ratio is `14/30 ≈ 46.6%`, so a
custom `--ttl 10d` gets roughly a 4.6-day grace window.

## Revalidation: cheap before expensive

When a lookup lands inside the **grace window**, Bonsai tries to revalidate
instead of re-downloading:

1. **Fresh** → serve the local file immediately.
2. **Expired** (past the grace window) → full refetch.
3. **Stale (in grace)** → if the entry stored an `ETag` or `Last-Modified`,
   send a conditional request (`If-None-Match` / `If-Modified-Since`):
   - **304 Not Modified** → touch the entry, extend `stale_after`, serve the
     cached copy. No body is downloaded or parsed, so it stays cheap.
   - **200 OK** → scrape the new HTML and update the cache.
   - **Network error / offline** → see below.

## Offline & stale serving

If revalidation fails because the remote is unreachable:

- **Inside the grace window** with `--allow-stale` → serve the cached note and
  exit `0`.
- **Inside the grace window** without `--allow-stale` → serve the cached note
  (so the caller is not blocked) but exit with code **`5`** to signal the
  content is stale and unverified.
- **Expired** → attempt a full fetch; if that fails, exit `1`.

See [Agent Integration](/how-to/agent-integration#exit-codes) for handling these
exit codes in scripts.
