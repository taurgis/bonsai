---
topic: salesforce LWR aura endpoint architecture guest user bootstrap fwuid cookies
slug: salesforce-lwr-aura-endpoint-architecture
tier: standard
sources:
  - https://developer.salesforce.com/docs/platform/lwc/guide/security-lwsec-aura-endpoints.html
  - https://www.varonis.com/blog/misconfigured-salesforce-experiences
  - https://appomni.com/ao-labs/lightning-components-a-treatise-on-apex-security-from-an-external-perspective/
  - https://news.fyself.com/how-to-test-a-salesforce-experience-site-like-an-apex-predator/
  - https://github.com/moniik/poc_salesforce_lightning/blob/main/exploit.py
  - https://developer.salesforce.com/docs/platform/lwr/guide/lwr-enable-ssr-site.html
  - https://trailhead.salesforce.com/content/learn/modules/lightning-web-runtime-for-experience-cloud/get-started-with-lightning-web-runtime
fetched_at: 2026-06-24T00:00:00Z
validated_at: 2026-06-24T00:00:00Z
source_version: Salesforce Experience Cloud (current as of 2026-06; Spring 26 / API v66)
status: active
---

# Salesforce LWR vs Aura Endpoint Architecture

## The /s/sfsites/aura Endpoint (Classic Aura Sites)

The Aura endpoint is the server-side action bridge for **Aura-based** Experience Cloud sites. It is a POST endpoint at `https://<site>.force.com/s/sfsites/aura`.

### aura.context Structure

Extracted from the initial GET response of the site's home page. The GET response embeds a URL-encoded path containing the fwuid. The typical aura.context JSON:

```json
{
  "mode": "PROD",
  "fwuid": "<framework-uid-extracted-from-initial-GET>",
  "app": "siteforce:communityApp",
  "loaded": { "APPLICATION@markup://siteforce:communityApp": "<hash>" },
  "dn": [],
  "globals": {},
  "uad": false
}
```

- `fwuid` is embedded in the initial GET response as a URL-encoded value in a path segment like `/s/sfsites/l/...`. A regex such as `r'"fwuid":"([^"]+)'` extracts it from the decoded response body.
- `uad` must be `false` for certain component retrieval actions.

### aura.token for Guest/Anonymous Users

The literal string `"undefined"` (or the string `"null"` per some sources). Authenticated users have a JWT value here. For guest users, passing `"undefined"` signals the request comes from the guest user profile context.

### Cookies

- `BrowserId` – set by Salesforce on first GET, identifies the browser session.
- `CookieConsentPolicy` – Experience Cloud cookie consent flag.
- `renderCtx` – affects which component definitions and data are returned for a given page context.
- No `sid` cookie is required for guest/anonymous access. The guest session is implicit when `aura.token` is `"undefined"`.
- Cookies are set by the initial GET request to the site homepage. A plain HTTP GET without a real browser suffices to acquire these cookies.

### POST Request Format

Form-encoded body with three fields:
- `message` – JSON with an `actions` array, each action has `descriptor` (e.g., `apex://MyController/ACTION$myMethod`), `callingDescriptor`, and `params`.
- `aura.context` – JSON string as above.
- `aura.token` – `"undefined"` for guest.

## LWR Sites: The Aura Endpoint Is Blocked

On **LWR (Lightning Web Runtime)** sites, the `/s/sfsites/aura` endpoint is architecturally different. Salesforce Lightning Web Security (LWS), which governs LWR sites, **explicitly disallows** client-side JavaScript from making `fetch`, `XMLHttpRequest`, `Navigator.sendBeacon`, or `HTMLObjectElement.data` calls to any URL containing `/aura` or `/webruntime`. This is documented in:

> "Lightning Web Security (LWS) disallows access to URL endpoints containing `/aura` and `/webruntime` because they're part of the Lightning Component framework." — Salesforce LWS docs

This means LWR site JavaScript cannot directly call `/s/sfsites/aura`. Apex methods are called via a different internal transport (not `/s/sfsites/aura`) on LWR sites.

### How Apex Is Called from LWR LWCs

LWC components on LWR sites call `@AuraEnabled` Apex methods via `@wire` decorators or imperative imports, using the framework's internal wire service transport. The underlying HTTP path for these calls on LWR sites is **not** `/s/sfsites/aura` – it goes through the LWR wire bridge at a different internal path.

From an external server-side perspective, you cannot replicate this call without the LWR framework context.

## LWR Page Bootstrap / Embedded Config

LWR sites use server-side rendering (SSR) where data from `getServerData()` hook is serialized as HTML `markup` into the page document. However:

- Coveo search tokens are **not** typically embedded in the initial HTML of help.salesforce.com. Tokens are short-lived (24 h default) and user-specific; embedding them in SSR'd HTML would expose them to all visitors.
- The LWR page may embed organization-level config (org ID, search hub name, endpoint base URL) in static JS/JSON, but the **access token / search token itself** is fetched dynamically by the LWC at runtime via an Apex call.
- There is no documented `window.__LWR__`, `window.LWR`, or `__lwr_bootstrap__` global that contains a live Coveo token.

## help.salesforce.com Site Type

help.salesforce.com is an Experience Cloud site running on an **LWR template** (Build Your Own / BYO LWR). This means:

1. The `/s/sfsites/aura` endpoint pattern still exists at the URL level (it is a siteforce URL), but LWS prevents in-browser JavaScript from calling it.
2. External HTTP calls (from a server/script) to `/s/sfsites/aura` on an LWR site may receive a response structurally, but the Apex controllers referenced by Coveo components on LWR sites may not be wired through the Aura action bridge – they use LWC wire service instead.
3. The Coveo token is generated by a server-side Apex controller (`@AuraEnabled` method implementing `ITokenProvider`) that returns `{ organizationId, accessToken }`. This Apex call goes through the LWR internal wire transport, not the public Aura POST endpoint.
