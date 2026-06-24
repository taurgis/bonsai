# US-05 Freshness and Revalidation

## Epic Goal

Cached research is reused while trustworthy and revalidated when stale.

## US-05.1 Serve Fresh Cache Hits

Priority: P0

As an AI coding agent, I want fresh cached research returned without network access, so that repeated work is fast and deterministic.

Acceptance criteria:

- A fresh cache hit does not fetch the source.
- JSON output identifies the result as a cache hit.
- The artifact path and validation timestamp are returned.
- The returned content matches the requested format.

## US-05.2 Apply Freshness Tiers

Priority: P1

As an AI coding agent, I want sources assigned to freshness tiers, so that stable specs and volatile release notes age differently.

Acceptance criteria:

- Supported tiers are `stable`, `standard`, and `volatile`.
- Each tier has a documented fresh window and grace policy.
- The default tier is documented.
- Tier metadata is stored in frontmatter.

## US-05.3 Accept Explicit TTL

Priority: P1

As an AI coding agent, I want to pass `--ttl`, so that I can express my estimate of source volatility when I know it.

Acceptance criteria:

- TTL strings are parsed from documented units.
- Invalid TTLs exit `2`.
- TTL behavior relative to `--tier` is documented.
- TTL metadata is stored in frontmatter.

## US-05.4 Revalidate Stale Unchanged Sources

Priority: P0

As a developer, I want stale content revalidated cheaply when the source has not changed, so that the cache remains useful without full re-extraction.

Acceptance criteria:

- Stale artifacts trigger revalidation.
- If source content is unchanged, `validated_at` is updated.
- The detailed and compressed bodies are not rewritten unnecessarily.
- JSON output identifies `stale-revalidated`.

## US-05.5 Refresh Changed Sources

Priority: P1

As an AI coding agent, I want changed sources re-fetched and re-extracted, so that stale cached content does not mislead me.

Acceptance criteria:

- Changed content updates the content hash.
- Changed content updates both returned representation and stored artifact.
- Previous good content is not lost until replacement succeeds.
- JSON output identifies `stale-refetched`.

## US-05.6 Handle Unavailable Sources

Priority: P1

As an AI coding agent, I want unavailable sources handled without destroying cached research, so that transient network failures do not erase useful context.

Acceptance criteria:

- Fetch failure never overwrites a good artifact.
- Within grace, stale serving behavior follows the documented exit-code decision.
- Beyond grace, the command fails with exit `1` when no trustworthy content can be served.
- JSON output includes the unavailable reason in `stderr` or structured data.

## US-05.7 Treat Volatile Sources Strictly

Priority: P1

As a developer, I want volatile sources revalidated successfully before trust, so that release notes and security-sensitive pages are not served beyond their useful life.

Acceptance criteria:

- Volatile stale entries require successful revalidation before being considered trusted.
- Volatile grace behavior is explicitly tested.
- Human and JSON output make stale volatile status visible.

## US-05.8 Apply Read-Time Max Age

Priority: P2

As an AI coding agent, I want to require a maximum cache age for a single read, so that I can avoid trusting old artifacts without changing their stored policy.

Acceptance criteria:

- `--max-age` accepts the same duration syntax as `--ttl`.
- `--max-age` compares against `max(fetched_at, validated_at)`.
- `--max-age` does not mutate stored `tier`, `ttl`, or `stale_after`.
- JSON output identifies when `--max-age` forced refresh or rejection.
