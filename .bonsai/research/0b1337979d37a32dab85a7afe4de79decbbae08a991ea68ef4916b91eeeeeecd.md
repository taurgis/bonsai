---
schema_version: 1
artifact_type: section
source_url: https://docs.github.com/en/copilot/reference/hooks-reference#http-hookshttpsdocsgithubcomencopilotreferencehooks-referencehttp-hooks
source_urls:
  - https://docs.github.com/en/copilot/reference/hooks-reference#http-hookshttpsdocsgithubcomencopilotreferencehooks-referencehttp-hooks
normalized_url: https://docs.github.com/en/copilot/reference/hooks-reference
cache_key: 0b1337979d37a32dab85a7afe4de79decbbae08a991ea68ef4916b91eeeeeecd
topic: 
tags:
  - hook
  - hooks
  - agent
  - cloud
  - tool
format_available:
  - compressed
  - detailed
tier: standard
ttl: 
fetched_at: 2026-06-26T17:01:37.479Z
validated_at: 2026-06-26T17:01:37.479Z
stale_after: 2026-07-26T17:01:37.479Z
capture_method: static_fetch
extraction_status: extracted
extraction_confidence: high
quality_notes:
  - readability extracted main article
  - quality:oversized
  - auto-generated tags via keyword extraction
supplied_at: 
supplied_by: 
etag: 
last_modified: 
content_hash: 3062d0824eedeccbd216d1dab967a2870358ecca1fcaaf87d44278aad7401d65
token_estimate:
  compressed: 353
  detailed: 372
status: active
site_module_id: 
docs_engine: next
docs_framework: 
source_doc_url: 
search_provider: 
parent_cache_key: 3a3779552885fa7fab002102b26e371348ef1a56fd4ebd9efb331f9b4aa0ed59
section_anchor: http-hookshttpsdocsgithubcomencopilotreferencehooks-referencehttp-hooks
section_heading_path: [Hook configuration format](https://docs.github.com/en/copilot/reference/hooks-reference#hook-configuration-format) > [HTTP hooks](https://docs.github.com/en/copilot/reference/hooks-reference#http-hooks)
---

## Summary

[Hook configuration format](https://docs.github.com/en/copilot/reference/hooks-reference#hook-configuration-format) > [HTTP hooks](https://docs.github.com/en/copilot/reference/hooks-reference#http-hooks)

## Compressed

### [HTTP hooks]

HTTP hooks send the input payload as a JSON `POST` to a URL.

Note

*   By default, only `https://` URLs are allowed. Non-TLS `http://` requests are rejected, except for `http://localhost`, `http://127.*`, and `http://[::1]` when `COPILOT_HOOK_ALLOW_LOCALHOST=1` is set.
*   **Cloud agent only.** Outbound network from the sandbox is restricted by the cloud agent firewall, so `url` must target an allow-listed host.

```json
{
  "version": 1,
  "hooks": {
    "postToolUse": [
      {
        "type": "http",
        "url": "https://hooks.example.com/copilot",
        "headers": { "X-Source": "copilot-cli" },
        "allowedEnvVars": ["GITHUB_TOKEN"],
        "timeoutSec": 30
      }
    ]
  }
}
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| allowedEnvVars | string[] | No | Environment variable names that may be expanded inside headers values. When set, url must use https://. |
| headers | object | No | Request headers to include. |
| timeout | number | No | Alias for timeoutSec, in seconds. Used only when timeoutSec is absent; timeoutSec takes precedence when both are present. |
| timeoutSec | number | No | Timeout in seconds. Default: 30. |
| type | "http" | Yes | Must be "http". |
| url | string | Yes | Target URL. Must use http: or https:. For preToolUse and permissionRequest, must use https:// because the response can grant tool permissions. |

## Detailed

### [HTTP hooks](https://docs.github.com/en/copilot/reference/hooks-reference#http-hooks)

HTTP hooks send the input payload as a JSON `POST` to a URL.

Note

*   By default, only `https://` URLs are allowed. Non-TLS `http://` requests are rejected, except for `http://localhost`, `http://127.*`, and `http://[::1]` when `COPILOT_HOOK_ALLOW_LOCALHOST=1` is set.
*   **Cloud agent only.** Outbound network from the sandbox is restricted by the cloud agent firewall, so `url` must target an allow-listed host.

```json
{
  "version": 1,
  "hooks": {
    "postToolUse": [
      {
        "type": "http",
        "url": "https://hooks.example.com/copilot",
        "headers": { "X-Source": "copilot-cli" },
        "allowedEnvVars": ["GITHUB_TOKEN"],
        "timeoutSec": 30
      }
    ]
  }
}
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| allowedEnvVars | string[] | No | Environment variable names that may be expanded inside headers values. When set, url must use https://. |
| headers | object | No | Request headers to include. |
| timeout | number | No | Alias for timeoutSec, in seconds. Used only when timeoutSec is absent; timeoutSec takes precedence when both are present. |
| timeoutSec | number | No | Timeout in seconds. Default: 30. |
| type | "http" | Yes | Must be "http". |
| url | string | Yes | Target URL. Must use http: or https:. For preToolUse and permissionRequest, must use https:// because the response can grant tool permissions. |

## Provenance

Section "[Hook configuration format](https://docs.github.com/en/copilot/reference/hooks-reference#hook-configuration-format) > [HTTP hooks](https://docs.github.com/en/copilot/reference/hooks-reference#http-hooks)" of https://docs.github.com/en/copilot/reference/hooks-reference (parent 3a3779552885fa7fab002102b26e371348ef1a56fd4ebd9efb331f9b4aa0ed59)