# US-03 Cache and Storage

## Epic Goal

Research artifacts are stored locally in a transparent, deterministic, and recoverable way.

## US-03.1 Normalize URL and Build Cache Key

Priority: P0

As a maintainer, I want a deterministic cache key for each normalized source URL, so that equivalent requests reuse one artifact instead of creating duplicates.

Acceptance criteria:

- HTTP and HTTPS URLs are normalized consistently.
- The cache key is based on normalized URL and documented key inputs.
- Raw URL text is not used directly as a filesystem path.
- Equivalent URL normalization has unit tests.
- Different topics or tags do not produce separate artifacts for the same source.

## US-03.2 Store Inspectable Artifacts

Priority: P0

As a developer, I want each research result stored as a human-readable artifact with frontmatter, so that I can inspect source, timestamps, hashes, and content without proprietary tooling.

Acceptance criteria:

- Artifacts are Markdown or another documented transparent text format.
- Frontmatter includes source URL, normalized URL, cache key, timestamps, tier/TTL, content hash, status, and token estimates.
- The artifact includes or references both compressed and detailed representations.
- Durable artifacts are stored under the oclif data directory, not the project repo.

## US-03.3 Rebuild Lookup State from Artifacts

Priority: P0

As a maintainer, I want cache lookup to be recoverable from artifact frontmatter, so that corrupt derived state does not lose the cache.

Acceptance criteria:

- Scan-based lookup works without an index.
- Any future index is treated as derived state.
- Missing or corrupt derived state does not prevent artifact lookup.
- Corrupt artifacts are skipped or archived with diagnostics.

## US-03.4 Locate Cached Research

Priority: P2

As a developer, I want to find where an artifact is stored, so that I can inspect or clean it manually.

Acceptance criteria:

- JSON output includes the artifact path.
- Human output can show the artifact path without polluting extracted content streams.
- Paths are absolute or clearly rooted.

## US-03.5 Archive Superseded Artifacts

Priority: P2

As a maintainer, I want superseded artifacts archived rather than deleted, so that prior research remains auditable.

Acceptance criteria:

- Superseded artifacts can be marked inactive.
- Inactive artifacts are excluded from cache hits.
- The active artifact records supersession metadata when applicable.

## US-03.6 Search Cached Research by Keywords

Priority: P2

As an AI coding agent, I want to search existing cached research by keywords before starting URL research, so that I can reuse prior work when I do not know the exact URL.

Acceptance criteria:

- `research search <query>` searches local cached artifacts only.
- Search does not fetch the web or mutate cache state.
- Search matches topic, tags, source URLs, summary, and compressed content.
- Results include artifact path, artifact type, source URLs, freshness, capture method, token estimates, and snippets.
- JSON output uses the standard Forward Nexus envelope.
