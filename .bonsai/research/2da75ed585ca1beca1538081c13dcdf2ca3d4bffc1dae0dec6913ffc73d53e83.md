---
schema_version: 1
artifact_type: section
source_url: https://nodejs.org/api/fs.html#fsrealpathsyncnativepath-options
source_urls:
  - https://nodejs.org/api/fs.html#fsrealpathsyncnativepath-options
normalized_url: https://nodejs.org/api/fs.html
cache_key: 2da75ed585ca1beca1538081c13dcdf2ca3d4bffc1dae0dec6913ffc73d53e83
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
content_hash: 146da7e5954cca43e9c7254a3b9c2cf8f63421a38a93adfee669d0024fc56988
token_estimate:
  compressed: 187
  detailed: 187
status: active
site_module_id: 
docs_engine: next
docs_framework: fumadocs
source_doc_url: https://raw.githubusercontent.com/nodejs/node/main/doc/api/fs.md
search_provider: 
parent_cache_key: e592a8e6818242987d359207b9042a5ad8f72a785792e1b5fcaa69c82fb3077a
section_anchor: fsrealpathsyncnativepath-options
section_heading_path: File system > Synchronous API > `fs.realpathSync.native(path[, options])`
---

## Summary

File system > Synchronous API > `fs.realpathSync.native(path[, options])`

## Compressed

### `fs.realpathSync.native(path[, options])`

<!-- YAML
added: v9.2.0
-->

* `path` {string|Buffer|URL}
* `options` {string|Object}
  * `encoding` {string} **Default:** `'utf8'`
* Returns: {string|Buffer}

Synchronous realpath(3).

Only paths that can be converted to UTF8 strings are supported.

The optional `options` argument can be a string specifying an encoding, or an
object with an `encoding` property specifying the character encoding to use for
the path returned. If the `encoding` is set to `'buffer'`,
the path returned will be passed as a {Buffer} object.

On Linux, when Node.js is linked against musl libc, the procfs file system must
be mounted on `/proc` in order for this function to work. Glibc does not have
this restriction.

## Detailed

### `fs.realpathSync.native(path[, options])`

<!-- YAML
added: v9.2.0
-->

* `path` {string|Buffer|URL}
* `options` {string|Object}
  * `encoding` {string} **Default:** `'utf8'`
* Returns: {string|Buffer}

Synchronous realpath(3).

Only paths that can be converted to UTF8 strings are supported.

The optional `options` argument can be a string specifying an encoding, or an
object with an `encoding` property specifying the character encoding to use for
the path returned. If the `encoding` is set to `'buffer'`,
the path returned will be passed as a {Buffer} object.

On Linux, when Node.js is linked against musl libc, the procfs file system must
be mounted on `/proc` in order for this function to work. Glibc does not have
this restriction.

## Provenance

Section "File system > Synchronous API > `fs.realpathSync.native(path[, options])`" of https://nodejs.org/api/fs.html (parent e592a8e6818242987d359207b9042a5ad8f72a785792e1b5fcaa69c82fb3077a)