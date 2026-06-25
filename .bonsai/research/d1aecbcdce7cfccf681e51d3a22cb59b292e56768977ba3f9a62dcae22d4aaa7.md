---
schema_version: 1
artifact_type: section
source_url: https://nodejs.org/api/fs.html#fsunlinksyncpath
source_urls:
  - https://nodejs.org/api/fs.html#fsunlinksyncpath
normalized_url: https://nodejs.org/api/fs.html
cache_key: d1aecbcdce7cfccf681e51d3a22cb59b292e56768977ba3f9a62dcae22d4aaa7
topic: Node fs Stats
tags:
  - node
  - fs
format_available:
  - compressed
  - detailed
tier: stable
ttl: 
fetched_at: 2026-06-25T10:04:35.071Z
validated_at: 2026-06-25T10:04:35.071Z
stale_after: 2026-12-22T10:04:35.071Z
capture_method: github_source
extraction_status: extracted
extraction_confidence: high
quality_notes:
  - captured from public Markdown/MDX source: https://raw.githubusercontent.com/nodejs/node/main/doc/api/fs.md
supplied_at: 
supplied_by: 
etag: W/"5aa2abc8c1e13210749c83b3b7467111"
last_modified: Wed, 24 Jun 2026 07:13:53 GMT
content_hash: 700ece577ca0a78cff61b38b23a33ced4530a94a2659a3dc20785d0f8d4a1f06
token_estimate:
  compressed: 81
  detailed: 81
status: active
site_module_id: 
docs_engine: next
docs_framework: fumadocs
source_doc_url: https://raw.githubusercontent.com/nodejs/node/main/doc/api/fs.md
search_provider: 
parent_cache_key: e592a8e6818242987d359207b9042a5ad8f72a785792e1b5fcaa69c82fb3077a
section_anchor: fsunlinksyncpath
section_heading_path: File system > Synchronous API > `fs.unlinkSync(path)`
---

## Summary

File system > Synchronous API > `fs.unlinkSync(path)`

## Compressed

### `fs.unlinkSync(path)`

<!-- YAML
added: v0.1.21
changes:
  - version: v7.6.0
    pr-url: https://github.com/nodejs/node/pull/10739
    description: The `path` parameter can be a WHATWG `URL` object using `file:`
                 protocol.
-->

* `path` {string|Buffer|URL}

Synchronous unlink(2). Returns `undefined`.

## Detailed

### `fs.unlinkSync(path)`

<!-- YAML
added: v0.1.21
changes:
  - version: v7.6.0
    pr-url: https://github.com/nodejs/node/pull/10739
    description: The `path` parameter can be a WHATWG `URL` object using `file:`
                 protocol.
-->

* `path` {string|Buffer|URL}

Synchronous unlink(2). Returns `undefined`.

## Provenance

Section "File system > Synchronous API > `fs.unlinkSync(path)`" of https://nodejs.org/api/fs.html (parent e592a8e6818242987d359207b9042a5ad8f72a785792e1b5fcaa69c82fb3077a)