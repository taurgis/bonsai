---
topic: CDP Network domain enable responseReceived loadingFinished getResponseBody getCookies
slug: cdp-network-domain
tier: stable
sources:
  - https://chromedevtools.github.io/devtools-protocol/tot/Network/
  - https://chromedevtools.github.io/devtools-protocol/tot/Network/#type-Cookie
fetched_at: 2026-06-24T00:00:00Z
validated_at: 2026-06-24T00:00:00Z
source_version: Chrome DevTools Protocol (tip-of-tree)
status: active
---

# CDP Network Domain

Source: https://chromedevtools.github.io/devtools-protocol/tot/Network/

## Network.enable (method)

Enables network tracking. Network events will be delivered to the client after this call.

Parameters (all optional):
- `maxTotalBufferSize` (integer) — total buffer size for all network payloads (bytes)
- `maxResourceBufferSize` (integer) — per-resource buffer size (bytes)
- `maxPostDataSize` (integer) — longest post body retained (bytes)

## Network.responseReceived (event)

Fired when an HTTP response is available (headers received; body may not be complete yet).

Parameters:
- `requestId` (RequestId, required) — correlates with loadingFinished and getResponseBody
- `loaderId` (LoaderId, required)
- `timestamp` (MonotonicTime, required)
- `type` (ResourceType, required) — e.g. "XHR", "Fetch", "Document"
- `response` (Response, required) — response object containing status, headers, mimeType, url, etc.
- `hasExtraInfo` (boolean, optional) — whether extra info events will also be emitted for this request
- `frameId` (Page.FrameId, optional)

## Network.loadingFinished (event)

Fired when the HTTP request has fully loaded (body is available).

Parameters:
- `requestId` (RequestId, required) — same requestId as the corresponding responseReceived
- `timestamp` (MonotonicTime, required)
- `encodedDataLength` (number, required) — total bytes received for this request

## Ordering constraint

You MUST wait for `Network.loadingFinished` before calling `Network.getResponseBody`. The `responseReceived` event fires when headers arrive; the body is not yet in the buffer. Match events using the shared `requestId`.

## Network.getResponseBody (method)

Returns the response body for a completed request. Must be called after loadingFinished for the same requestId.

Parameters:
- `requestId` (RequestId, required)

Return object:
- `body` (string) — the response body; if base64Encoded is true, this is a base64-encoded string
- `base64Encoded` (boolean) — true when the body was sent as base64 (binary content); false for text/JSON

## Network.getCookies (method)

Returns all browser cookies for the given URLs (or the current page URL if no URLs specified).

Parameters:
- `urls` (array of string, optional) — restrict to cookies relevant to these URLs

Return object:
- `cookies` (array of Cookie)

## Network.getAllCookies (method)

Returns ALL browser cookies regardless of URL.

Parameters: none

Return object:
- `cookies` (array of Cookie)

Note: Marked deprecated in the protocol; the replacement is `Storage.getCookies`.

## Cookie type

Fields:
- `name` (string, required)
- `value` (string, required)
- `domain` (string, required)
- `path` (string, required)
- `expires` (number, required) — Unix timestamp; -1 means session cookie
- `size` (integer, required)
- `httpOnly` (boolean, required)
- `secure` (boolean, required)
- `session` (boolean, required)
- `sameSite` (CookieSameSite, optional) — "Strict" | "Lax" | "None"
- `priority` (CookiePriority, optional, experimental)
- `sourceScheme` (CookieSourceScheme, optional, experimental)
- `sourcePort` (integer, optional, experimental)
- `partitionKey` (CookiePartitionKey, optional, experimental)
- `partitionKeyOpaque` (boolean, optional, experimental)
