---
topic: coveo search token provisioning endpoint API key requirements anonymous
slug: coveo-search-token-provisioning
tier: standard
sources:
  - https://docs.coveo.com/56
  - https://docs.coveo.com/en/1369/
  - https://docs.coveo.com/en/102/
  - https://coveo.github.io/search-ui/interfaces/isearchendpointoptions.html
  - https://docs.coveo.com/en/105/build-a-search-ui/api-key-authentication
  - https://github.com/coveo/ui-kit/blob/master/packages/quantic/force-app/coveo-token/main/default/classes/CoveoTokenProvider.cls
  - https://github.com/coveooss/community-standalone-search-box/blob/master/pkg/classes/CoveoStandaloneSearchbox.cls
fetched_at: 2026-06-24T00:00:00Z
validated_at: 2026-06-24T00:00:00Z
source_version: Coveo Platform (cloud, current as of 2026-06)
status: active
---

# Coveo Search Token Provisioning

## Token Endpoint

`POST https://<ORG_ID>.org.coveo.com/rest/search/v2/token?organizationId=<ORG_ID>`

Alternate platform-level endpoint: `POST https://platform.cloud.coveo.com/rest/organizations/<ORG_ID>/tokens`

## Authorization Required

The caller **must** supply a Coveo API key in the `Authorization: Bearer <API_KEY>` header. There is no public/anonymous path to this endpoint. The API key must carry the **Search – Impersonate** privilege (targetDomain: `IMPERSONATE`) to generate user-scoped tokens.

For anonymous (guest) search only, a lower-privilege key with **Execute Queries** (`EXECUTE_QUERY`, privacyLevel: `PUBLIC`) is sufficient, but only if the search interface never touches secured content.

## Request Body (JSON)

```json
{
  "userIds": [
    {
      "name": "user@example.com",
      "provider": "Email Security Provider",
      "type": "User"
    }
  ],
  "searchHub": "HTCommunity",
  "filter": "@source==KnowledgeBase",
  "pipeline": "my-pipeline",
  "userGroups": ["Employees"],
  "validFor": 86400000
}
```

- `userIds` – required for impersonation; for anonymous pass `[{"name":"anonymous@coveo.com","provider":"Email Security Provider"}]` or empty.
- `searchHub` – optional if enforced on the API key itself; binds queries to a specific hub/pipeline.
- `filter` – optional; merged with query constant expression via AND.
- `pipeline` – optional; routes to a named query pipeline.
- `userGroups` – optional; passed through to analytics.
- `validFor` – optional; milliseconds; default 24 h.

## Can a Browser Client Obtain a Token Without an API Key?

**No.** The `/rest/search/v2/token` endpoint always requires an API key in the Authorization header. There is no unauthenticated path. Coveo explicitly documents: "Your server-side code will use the Authenticated search API key … and your Coveo search library client-side code will use the search token to authenticate requests to the Coveo Search API."

## Alternative: Expose a Public API Key Directly

For purely public/anonymous content, Coveo allows embedding an API key with `EXECUTE_QUERY` privilege and `privacyLevel: PUBLIC` directly in client-side code. This bypasses the need for a token endpoint call. However this only works when the search interface indexes only public content and the key carries minimum privileges.

## Coveo for Salesforce: Token Generation via Apex (CoveoV2.Globals)

When the Coveo for Salesforce managed package is installed, server-side token generation happens in Apex:

```apex
@AuraEnabled
public static String getHeadlessConfiguration() {
    Map<String, Object> endpoint = CoveoV2.Globals.getEndpointData();
    endpoint.put('accessToken', CoveoV2.Globals.generateSearchToken(
        new Map<String, Object>{ 'searchHub' => 'example_coveo' }
    ));
    return JSON.serialize(endpoint);
}
```

`CoveoV2.Globals.generateSearchToken()` is a server-side Apex method in the Coveo managed package. It uses the Coveo API key stored in Salesforce protected custom metadata (only accessible within the managed package namespace) to call the Coveo token endpoint. The Apex method accepts: `filter`, `searchHub`, `userGroups`, `additionnalUserIdentities`, `pipeline`, `validFor`.

The returned JSON contains `organizationId` and `accessToken` (the search token). This is what the LWC component uses as its Coveo endpoint configuration.
