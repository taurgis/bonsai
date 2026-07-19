---
schema_version: 1
artifact_type: section
source_url: https://nodejs.org/api/process.html#processreportreportonuncaughtexception
source_urls:
  - https://nodejs.org/api/process.html#processreportreportonuncaughtexception
normalized_url: https://nodejs.org/api/process.html
cache_key: f8d53f8c54cc0cc1a5cbf0dcf16bbfcb8be5fbffb607dee0068119e7adfdef84
topic: CLI audit rule sources
tags:
  - cli
  - audit
format_available:
  - compressed
  - detailed
tier: stable
ttl: 
fetched_at: 2026-07-19T09:32:19.200Z
validated_at: 2026-07-19T09:32:19.200Z
stale_after: 2027-01-15T09:32:19.200Z
capture_method: route_markdown
extraction_status: extracted
extraction_confidence: high
quality_notes:
  - captured from public Markdown/MDX source: https://nodejs.org/api/process.md
supplied_at: 
supplied_by: 
etag: W/"48702de64dfab46489cf1d05ed61d5ca"
last_modified: Wed, 08 Jul 2026 00:43:25 GMT
content_hash: 72b00dbf83832ddce3ce9301195567d360e4b8d21f24459121febab881aced14
token_estimate:
  compressed: 145
  detailed: 145
status: active
site_module_id: 
docs_engine: generated-static
docs_framework: 
source_doc_url: https://nodejs.org/api/process.md
search_provider: 
parent_cache_key: d2342125ff31ad6f21c7c2275d35aca77337453381c5417e93a8b0f7d25f86a1
section_anchor: processreportreportonuncaughtexception
section_heading_path: Process > process.report > process.report.reportOnUncaughtException
---

## Summary

Process > process.report > process.report.reportOnUncaughtException

## Compressed

### `process.report.reportOnUncaughtException`

<!-- YAML
added: v11.12.0
changes:
  - version:
     - v13.12.0
     - v12.17.0
    pr-url: https://github.com/nodejs/node/pull/32242
    description: This API is no longer experimental.
-->

* Type: {boolean}

If `true`, a diagnostic report is generated on uncaught exception.

```mjs
import { report } from 'node:process';

console.log(`Report on exception: ${report.reportOnUncaughtException}`);
```

```cjs
const { report } = require('node:process');

console.log(`Report on exception: ${report.reportOnUncaughtException}`);
```

## Detailed

### `process.report.reportOnUncaughtException`

<!-- YAML
added: v11.12.0
changes:
  - version:
     - v13.12.0
     - v12.17.0
    pr-url: https://github.com/nodejs/node/pull/32242
    description: This API is no longer experimental.
-->

* Type: {boolean}

If `true`, a diagnostic report is generated on uncaught exception.

```mjs
import { report } from 'node:process';

console.log(`Report on exception: ${report.reportOnUncaughtException}`);
```

```cjs
const { report } = require('node:process');

console.log(`Report on exception: ${report.reportOnUncaughtException}`);
```

## Provenance

Section "Process > process.report > process.report.reportOnUncaughtException" of https://nodejs.org/api/process.html (parent d2342125ff31ad6f21c7c2275d35aca77337453381c5417e93a8b0f7d25f86a1)