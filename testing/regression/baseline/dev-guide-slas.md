# Shopper Login and API Access Service (SLAS) Overview

The Shopper Login and API Access Service (SLAS) enables secure access to the Shopper APIs of the B2C Commerce API and the [Open Commerce API](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/b2c-commerce-ocapi/get-started-with-ocapi.html) (OCAPI).

Two admin tools are available for setting up SLAS: the [SLAS Admin API](https://developer.salesforce.com/docs/commerce/commerce-api/references?meta=slas-admin\:Summary) and the SLAS Admin UI. Both admin tools use Account Manager for access control, and they both require that you have the **SLAS Organization Administrator** role and the correct filters applied for your B2C Commerce instances.

To access the SLAS Admin UI, replace `{short-code}` in the following URL with the short code used by your B2C Commerce instances:

```text
https://{short-code}.api.commercecloud.salesforce.com/shopper/auth-admin/v1/ui/
```

To learn more about short codes, see the [Base URL and Request Formation](/docs/commerce/b2c-commerce/guide/base-url.html) guide.

For advice on how to use SLAS under high-volume situations, see this article on the Salesforce Developers blog: [Shopper Login API: Techniques and Tricks to Get the Most Out of High-Volume Holidays](https://developer.salesforce.com/blogs/2022/11/shopper-login-api-techniques-and-tricks-to-get-the-most-out-of-high-volume-holidays).

## SLAS Clients

To make authorized requests to SLAS, each application must be associated with one or more SLAS clients. Each SLAS client is registered to a single SLAS tenant and each SLAS tenant is associated with a single B2C Commerce instance.

A SLAS client can be created as one of two types: public or private. To choose the right client type for your application, the most important thing to ask is whether the client can be trusted to securely store a client secret or not. Use a private client when you can trust the client and use a public client when you cannot.

For example, a mobile app that communicates directly with SLAS must store the client secret on the shopper’s device, which is not secure. Therefore, most mobile apps use a public client. On the other hand, a mobile app with a backend for frontend (BFF) system *can* store a client secret in a secure location where the shopper’s device cannot access it. Any app with a BFF system can use a private client.

The following table summarizes which client types are used by the most common types of applications:

| Application                                             | Client Type    |
| ------------------------------------------------------- | -------------- |
| Single-page web app (for example, a PWA Kit storefront) | Public client  |
| Traditional full stack web app                          | Private client |
| Mobile app (Android or iOS)                             | Public client  |
| Any kind of app with a backend-for-frontend (BFF)       | Private client |

:::important
- Do not add shopper-related scopes to Account Manager clients.
- Do not add data- or admin-related scopes to SLAS clients.
- The previous actions cause token bloat and do not work as expected.
:::

## Grant Types and Token Types

The SLAS API is based on grant types defined by the [OAuth 2.1](https://oauth.net/2.1/) standard.

The grant type used for an access token request depends on the type of SLAS client (public or private) and the shopper’s authentication method.

Most SLAS clients request access tokens with the [getAccessToken](https://developer.salesforce.com/docs/commerce/commerce-api/references?meta=shopper-login\:getAccessToken) endpoint and receive a [ShopperToken](https://developer.salesforce.com/docs/commerce/commerce-api/references?meta=shopper-login\:security\:ShopperToken).

Trusted systems use the [getTrustedSystemAccessToken](https://developer.salesforce.com/docs/commerce/commerce-api/references?meta=shopper-login\:getTrustedSystemAccessToken) endpoint and receive a [ShopperTsob token](https://developer.salesforce.com/docs/commerce/commerce-api/references?meta=shopper-login\:security\:ShopperTokenTsob). This token has additional capabilities so that trusted systems can make requests on behalf of users.

Agents acting on behalf of shoppers use the [getTrustedAgentAccessToken](https://developer.salesforce.com/docs/commerce/commerce-api/references/auth?meta=getTrustedAgentAccessToken) endpoint and receive a [ShopperTokenTaob token](https://developer.salesforce.com/docs/commerce/commerce-api/references/auth?meta=security%3AShopperTokenTaob).

To get a SLAS token for a B2C Commerce session, use the [getSessionBridgeAccessToken](https://developer.salesforce.com/docs/commerce/commerce-api/references/auth?meta=getSessionBridgeAccessToken) endpoint.

The following table summarizes the different grant types and token types used by each type of SLAS client and user authentication method.

| SLAS Client | Authentication Method                   | Method                                                                                                                         | Grant Type              | Token       |
| ----------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------- | ----------- |
| Public      | None (guest user)                       | [getAccessToken](https://developer.salesforce.com/docs/commerce/commerce-api/guide/slas-public-client.html)                    | authorization_code_pkce | Shopper     |
| Public      | Registered user (federated login)       | [getAccessToken](https://developer.salesforce.com/docs/commerce/commerce-api/guide/slas-public-client.html)                    | authorization_code_pkce | Shopper     |
| Public      | Registered user (B2C Commerce login)    | [getAccessToken](https://developer.salesforce.com/docs/commerce/commerce-api/guide/slas-public-client.html)                    | authorization_code_pkce | Shopper     |
| Private     | None (guest user)                       | [getAccessToken](https://developer.salesforce.com/docs/commerce/commerce-api/guide/slas-private-client.html)                   | client_credentials      | Shopper     |
| Private     | Registered user (federated login)       | [getAccessToken](https://developer.salesforce.com/docs/commerce/commerce-api/guide/slas-private-client.html)                   | authorization_code      | Shopper     |
| Private     | Registered user (B2C Commerce login)    | [getAccessToken](https://developer.salesforce.com/docs/commerce/commerce-api/guide/slas-private-client.html)                   | authorization_code      | Shopper     |
| Private     | Registered user (B2C Commerce login)    | [getAccessToken](https://developer.salesforce.com/docs/commerce/commerce-api/guide/slas-private-client.html)                   | authorization_code_pkce | Shopper     |
| Private     | Trusted system on behalf of (TSOB) user | [getTrustedSystemAccessToken](https://developer.salesforce.com/docs/commerce/commerce-api/guide/slas-trusted-system.html)      | client_credentials      | ShopperTsob |
| Public      | Session Bridge (guest user)             | [getSessionBridgeAccessToken](https://developer.salesforce.com/docs/commerce/commerce-api/guide/slas-session-bridge-auth.html) | session_bridge          | ShopperSesb |
| Public      | Session Bridge (B2C Commerce login)     | [getSessionBridgeAccessToken](https://developer.salesforce.com/docs/commerce/commerce-api/guide/slas-session-bridge-auth.html) | session_bridge          | ShopperSesb |
| Private     | Session Bridge (guest user)             | [getSessionBridgeAccessToken](https://developer.salesforce.com/docs/commerce/commerce-api/guide/slas-session-bridge-auth.html) | client_credentials      | ShopperSesb |
| Private     | Session Bridge (B2C Commerce login)     | [getSessionBridgeAccessToken](https://developer.salesforce.com/docs/commerce/commerce-api/guide/slas-session-bridge-auth.html) | client_credentials      | ShopperSesb |
| Private     | Trusted agent on behalf of (TAOB)       | [getTrustedAgentAccessToken](https://developer.salesforce.com/docs/commerce/commerce-api/guide/slas-trusted-agent.html)        | client_credentials      | ShopperTaob |

## Access Tokens and Refresh Tokens

To request a [ShopperToken](https://developer.salesforce.com/docs/commerce/commerce-api/references?meta=shopper-login\:security\:ShopperToken), use the [getAccessToken](https://developer.salesforce.com/docs/commerce/commerce-api/references/auth?meta=getAccessToken) endpoint. To request a [ShopperTokenTsob](https://developer.salesforce.com/docs/commerce/commerce-api/references?meta=shopper-login\:security\:ShopperTokenTsob), use the [getTrustedSystemAccessToken](https://developer.salesforce.com/docs/commerce/commerce-api/references/auth?meta=getTrustedSystemAccessToken) endpoint.

Both endpoints return the following upon successful authorization:

- An access token in JSON Web Token (JWT) format
- A `customer_id` string
- A unique shopper identifier (USID)
- A refresh token

Access tokens are valid for 30 minutes. They can be used to make requests to any B2C Commerce API endpoints covered by the scopes of the issuing SLAS API client. They can request Open Commerce API endpoints for which the SLAS API client ID has been allowed. They may only be used to request APIs from the instance and site they were issued.

The refresh token can be used to request a new access token. For production tenants, refresh tokens are valid for 90 days for registered shoppers and 30 days for guests. On non-production tenants, refresh tokens are valid for 9 days. Using the refresh tokens extends the lifetime of the subsequently issued token by its lifetime duration.

Refresh tokens issued to using public clients are single use. When the refresh token is used, a new one is returned in the response. Refresh tokens issued using private clients may be used multiple times. The same refresh token is returned in the response.

- When a shopper changes their login ID or password, access tokens that were granted before the password change are revoked and rejected by both the B2C Commerce API and OCAPI. Prompt the shopper to log in again using the new credentials. Note that token revocation requires several minutes to complete, and is only enabled by default in production environments. For other environments, such as sandboxes, you must enable token revocation.
- The JWT returned by SLAS includes a number of claims. When writing code to inspect claims, be sure not to rely on ordering, as additional claims may be added.
- Access tokens allow you to act on behalf of the shopper. The actions taken can be sensitive, such as updating an account's email. Always take the necessary precautions to protect the shopper.

:::note
To initialize an Agentforce session, obtain a SLAS shopper access token that includes the `sfcc.shopper-agents.rw` scope, and then call the [Shopper Agents API](https://developer.salesforce.com/docs/commerce/commerce-api/references/shopper-agents?meta=Summary) with the `sessionInitKey` received at session start.
:::

### Guest Tokens

To prevent unauthorized access across different storefronts, the `channel_id` (site) parameter is required when requesting a guest access token with a `grant_type` of `client_credentials` or `authorization_code_pkce`. If this parameter is missing, your request receives a 400 invalid refresh token error.

:::important
Following a tiered rollout, the `channel_id` parameter requirement started being enforced for all production tenants on 9/9/25. For details, see the [SLAS Release Notes](https://developer.salesforce.com/docs/commerce/commerce-api/references/about-commerce-api/about.html#03182025).
Existing customers must update their implementation to include the `channel_id` parameter in their guest access token requests.
:::

These sample requests show the required use of the `channel_id` parameter.

#### Sample request for client_credentials

```sh
curl -X POST --location 'https://{shortCode}.api.commercecloud.salesforce.com/shopper/auth/v1/organizations/{organizationId}/oauth2/token' \
--header 'Content-Type: application/x-www-form-urlencoded' \
--header 'Authorization: Basic <client_id:secret>' \
--data-urlencode 'grant_type=client_credentials' \
--data-urlencode 'channel_id=RefArch'
```

#### Sample request for authorization_code_pkce

```sh
curl --location 'https://{shortCode}.api.commercecloud.salesforce.com/shopper/auth/v1/organizations/{organizationId}/oauth2/token' \
--header 'Content-Type: application/x-www-form-urlencoded' \
--data-urlencode 'code=4bc7QNx0NDc-n991Ppi6IiwPO6OaPrT_jMgF823lGyg' \
--data-urlencode 'grant_type=authorization_code_pkce' \
--data-urlencode 'redirect_uri=http://localhost:9010/callback' \
--data-urlencode 'client_id=3a15f34e-fecd-4fcc-8235-86b70978e629' \
--data-urlencode 'code_verifier=MyLi6hIowxiGsvBvvCJ0FV4AkOpOOnRHxC2PCsvD7yVLy4ZtzKl9Mv9a1r65dh1qg0ZvZ2nvMlLN8uYsZOKcj8cae1XbBBmD' \
--data-urlencode 'channel_id=SiteGenesis'
```

#### Sample request for fetching tokens

```sh
curl "https://$CODE.api.commercecloud.salesforce.com/shopper/auth/v1/organizations/$ORG/oauth2/token" \
    --user "$CLIENT:$SECRET" \
    --data 'grant_type=client_credentials' \
    --data "channel_id=$CHANNEL_ID"
```

Additionally, SLAS shopper tokens created for one site (Site A) can’t be used for making SCAPI or OCAPI calls for another site (Site B). For example, a SLAS access token that was requested for the `channel_id` of RefArch can only be used with SCAPI or OCAPI calls that use the same `site_id`:

```sh
curl --location 'https://sandbox-001.api.commercecloud.salesforce.com/product/shopper-products/v1/organizations/f_ecom_bcgl_stg/products?ids=nikon-d90-wlens&siteId=RefArch' \
--header 'Authorization: Bearer <access_token>'
```

### Decoded Access Tokens

You can view token details in the decoded access token, such as token lifespan or authorized scopes. For example:

#### Header

```json
{
  "ver": "1.0",
  "jku": "slas/prod/zzrf_001",
  "kid": "73290ac8-ee0d-414e-ae51-2078ab4dc4d1",
  "typ": "jwt",
  "clv": "J2.3.4",
  "alg": "ES256"
}
```

- `jku`: this is the same as the body `iss` claim.
- `kid` : the key id of the public key to use to validate token signature. Get the keys with the [getJwksUri](https://developer.salesforce.com/docs/commerce/commerce-api/references/auth?meta=getJwksUri) endpoint.

#### Body

```json
{
  "aut": "GUID",
  "scp": "sfcc.shopper-myaccount.baskets sfcc.shopper-discovery-search sfcc.shopper-myaccount.paymentinstruments sfcc.shopper-customers.login sfcc.shopper-experience sfcc.shopper-myaccount.orders sfcc.shopper-productlists sfcc.shopper-promotions sfcc.session_bridge sfcc.shopper-myaccount.paymentinstruments.rw sfcc.shopper-myaccount.productlists sfcc.shopper-categories sfcc.shopper-myaccount sfcc.shopper-myaccount.addresses sfcc.shopper-products sfcc.shopper-myaccount.rw sfcc.shopper-stores sfcc.shopper-customers.register sfcc.shopper-baskets-orders sfcc.shopper-myaccount.addresses.rw sfcc.shopper-myaccount.productlists.rw sfcc.shopper-baskets-orders.rw sfcc.shopper-gift-certificates sfcc.shopper-product-search sfcc.shopper-seo",
  "sub": "cc-slas::zzrf_001::scid:c9c45bfd-0ed3-4aa2-9971-40f88962b836::usid:51b61c73-3a52-4b29-ac90-5ace596e5b27",
  "ctx": "slas",
  "iss": "slas/prod/zzrf_001",
  "ist": 1,
  "dnt": "0",
  "aud": "commercecloud/prod/zzrf_001",
  "nbf": 1717191705,
  "sty": "User",
  "isb": "uido:slas::upn:Guest::uidn:Guest User::gcid:ablrdGlHdHlXkRk0cZkGYYwHg3::chid:RefArchGlobal",
  "exp": 1717193535,
  "iat": 1717191735,
  "jti": "C2C4856201860-1890678903105595297713040"
}
```

- `scp`: Scopes in the token. Unless specific scopes are requests, this will be the scopes of the SLAS client.
- `sub`: Contains the client_id, tenant_id, and usid.
- `dnt`: Shopper tracking preferences. For details, see [Manage Shopper Tracking Preferences](/docs/commerce/b2c-commerce/guide/slas-tracking-preferences.html).
- `isb`: Contains IDP origin, shopper information, guest id, registered shopper id, token type and channel id.

## Verify the SLAS Password Action Callback

To help verify the authenticity of passwordless login and password reset callbacks, SLAS provides a **SlasCallbackToken** (JWT) for each passwordless login and password reset callback that SLAS sends:

- SLAS adds a `x-slas-callback-token` HTTP header with the **SlasCallbackToken.**
- If SLAS is unable to create the **SlasCallbackToken,** the `x-slas-callback-token` HTTP header is not created, and you must use the callback body to retrieve the callback values.

:::important
SLAS makes the POST call to the given `callback_uri` without adding additional headers or parameters. If the `callback_uri` needs additional headers, such as an authorization header, you must have a proxy in place between SLAS and the `callback_uri` that can add any additional headers or parameters as needed.
:::

### Example SLAS Callback Header

```json
{
    "user-agent": "ReactorNetty/1.0.38",
    "host": "localhost:9003",
    "accept": "*/*",
    "x-correlation-id": "1cf7ce67-1d49-4ab5-832e-85daac619e4a",
    "content-type": "application/json",
    "x-slas-callback-token": "eyJraWQiOiIyZDY3MGZhOC0wZjI4LTQ0YTEtYjhiNC04N2E2ZDJmZWIxZDgiLCJ0eXAiOiJqd3QiLCJhbGciOiJFUzI1NiJ9.eyJlbWFpbF9pZCI6ImRhcnRoLnZhZGVyQGVuZG9yLm9yZyIsImxvZ2luX2lkIjoiZGFydGgudmFkZXIiLCJzdWIiOiI4NzlhOTczMC0zYjNlLTQ3N2QtOWVhMC0xYzdiYWI1ZjI4MzMiLCJwaG9uZSI6IiIsImlzcyI6InNsYXMvZGV2L2Jndm5fc3RnIiwiY3VzdG9tZXJfaWQiOiJhZFUxS0V3WEhLd3JiUjl5OVRhbjFPdHhXQSIsImV4cCI6MTcyNTQxNzMxMiwiaWF0IjoxNzI1NDE2NDEyLCJ0b2tlbiI6IjQwMjc1NTQ5IiwidXNpZCI6IjNmMDY4OTg3LWE3YWItNDE1Ny1iZmRkLTBmOGY4MjYzMzlkNSJ9.gFdqdu5gNNyZ6g2eFehbgOzY5DsoJZcHg0G5EZyhHy_FnD0bTFxE_pGzMgxttUrpeI7o7UBXGzvK5YL3K4wtAA",
    "content-length": "180"
}
```

### Example SLAS Callback Body

```json
{
    "email_id": "darth.vader@endor.org",
    "login_id": "darth.vader",
    "phone": "",
    "customer_id": "adU1KEwXHKwrbR9y9Tan1OtxWA",
    "token": "40275549",
    "usid": "3f068987-a7ab-4157-bfdd-0f8f826339d5"
}
```

### Steps to Validate SLAS Passwordless Login and Password Reset Callbacks

1. Extract the `x-slas-callback-token` header from the request. Using the previous examples, callback header values are:

```text
eyJraWQiOiIyZDY3MGZhOC0wZjI4LTQ0YTEtYjhiNC04N2E2ZDJmZWIxZDgiLCJ0eXAiOiJqd3QiLCJhbGciOiJFUzI1NiJ9.eyJlbWFpbF9pZCI6ImRhcnRoLnZhZGVyQGVuZG9yLm9yZyIsImxvZ2luX2lkIjoiZGFydGgudmFkZXIiLCJzdWIiOiI4NzlhOTczMC0zYjNlLTQ3N2QtOWVhMC0xYzdiYWI1ZjI4MzMiLCJwaG9uZSI6IiIsImlzcyI6InNsYXMvZGV2L2Jndm5fc3RnIiwiY3VzdG9tZXJfaWQiOiJhZFUxS0V3WEhLd3JiUjl5OVRhbjFPdHhXQSIsImV4cCI6MTcyNTQxNzMxMiwiaWF0IjoxNzI1NDE2NDEyLCJ0b2tlbiI6IjQwMjc1NTQ5IiwidXNpZCI6IjNmMDY4OTg3LWE3YWItNDE1Ny1iZmRkLTBmOGY4MjYzMzlkNSJ9.gFdqdu5gNNyZ6g2eFehbgOzY5DsoJZcHg0G5EZyhHy_FnD0bTFxE_pGzMgxttUrpeI7o7UBXGzvK5YL3K4wtAA
```

2. Use the SLAS `/jwks` endpoint to get the public key to verify the JWT signature. The response includes public keys for your tenant, for example:

```json
{
    "keys": [
        {
            "kty": "EC",
            "crv": "P-256",
            "use": "sig",
            "kid": "2d670fa8-0f28-44a1-b8b4-87a6d2feb1d8",
            "x": "_2tPqxGhgX6cA5Qg7v6UH_9om8OR3-OehkgXXWraTp8",
            "y": "DAykmQPtf282buIcL0rLwKYbK6ApgripMjazdAthUFw"
        },
        {
            "kty": "EC",
            "crv": "P-256",
            "use": "sig",
            "kid": "eb70508f-4d64-46f7-a3d5-b36558d6e6b6",
            "x": "VV0JVJFhkz71wY0E73Z-snorZ5oJf1QOdkIbCjyMqLs",
            "y": "QLkqBVSPPrkd7HjaSEMgMU9Ob-FDpg1W-oLq5I4ExqQ"
        }
    ]
}
```

3. Use the public key to verify the `SlasCallbackToken` signature:

- You can use several JSON Web Token (JWT) libraries to verify the **SlasCallbackToken** signature. See [JWT Libraries](https://jwt.io/libraries) to find a Json Web Token (JWT) library for your programming language. For example, verify the signature using the Java `nimbus-jose-jwt` library:

```java
// prerequisite is to get the public keys using the SLAS /jwks endpoint
// response into a String.

import com.nimbusds.jose.JWSVerifier;
import com.nimbusds.jose.crypto.ECDSAVerifier;
import com.nimbusds.jose.jwk.ECKey;
import com.nimbusds.jwt.SignedJWT;
import org.apache.commons.lang3.StringUtils;
import org.json.JSONArray;
import org.json.JSONObject;

public boolean isSignatureValid(String callbackJwt) {

    ECDSAVerifier jwksVerifier = null;

    try {
        // publicKeys value is from the /jwks endpoint
        JSONObject publicKeyJSON = new JSONObject(publicKeys);
        JSONArray publicKeyArray = publicKeyJSON.getJSONArray("keys");
        // Build a signed JWT
        SignedJWT callbackSignedJWT = SignedJWT.parse(callbackJwt);
        // Get the signing key id.
        String jwtKeyId = callbackSignedJWT.getHeader().getKeyID();

        // Find the signing key from the array of public keys.
        // If found then create a verifier.
        for(Object jo : publicKeyArray) {
         if( StringUtils.equals(((JSONObject)jo).getString("kid"), jwtKeyId)) {
            String publicKey = jo.toString();
            jwksVerifier = new ECDSAVerifier(ECKey.parse(publicKey));
            break;
          }
        }

       if(Objects.nonNull(jwksVerifier) ) {
           // Verify the JWT.
           return callbackSignedJWT.verify(jwksVerifier);
       } else {
           return false;
       }
    }
    catch(ParseException | JOSEException e) {
        return false;
    }
 }
```

## Shopper Tracking Preferences

You can incorporate shopper tracking preferences into your applications. When you get a SLAS token using `getAccessToken`, you specify a tracking preference. The tracking preference is respected for all requests using that token. After the B2C Commerce 24.4 release, the Shopper Login API will include a boolean `dnt` parameter to set `Do Not Track` for the session. If not defined, the `dnt` value defaults to `false`.

For details, see: [Manage Shopper Tracking Preferences.](https://developer.salesforce.com/docs/commerce/commerce-api/guide/slas-tracking-preferences.html)

## View SLAS Error Logs in Log Center

SLAS 4xx and 5xx error logs are available in Log Center, which provides multiple benefits, including a single URL for all realms, up to 14 days of log data, and improved search capabilities.

To access SLAS 4xx and 5xx error logs:

1. If you built your site using Progressive Web App (PWA) Kit, first complete the prerequisites described in [Debug Using Log Center](/docs/commerce/b2c-commerce/guide/debugging.html#debug-using-log-center).
2. [Start Log Center](https://help.salesforce.com/s/articleView?id=cc.b2c_start_log_center.htm\&type=5).
3. Select a Region.
4. Select a [Realm](https://help.salesforce.com/s/articleView?id=cc.b2c_platform_overview.htm\&type=5). If you don’t know your realm ID, ask your Account Executive (AE) or Customer Success Manager (CSM).
5. Select **Show filtered results**.
6. Select **Search** and then select **Current Search**.
7. In **Service Type**, select **SLAS logs**.
8. For a faster search, use an LCQL query, which filters the results using a specific `httpStatus` code:
   1. Select **Search** and then select **Current Search**.
   2. In the **Search** page, enter an `(httpstatus)` code for **LCQL**, for example: `text:(httpstatus) AND text:(401)`.

## SLAS Rate Limits

For SLAS rate limits, troubleshooting guidance, and best practices, see [Load Shedding and Rate Limiting](/docs/commerce/b2c-commerce/guide/throttle-rates.html#shopper-login-and-api-access-service-slas).

## Constraints

- A SLAS service protection mechanism restricts calls to the same SLAS endpoint repeatedly using the same USID (Unique Shopper ID) within a short span of time. This returns a 409 HTTP response.

- Some SLAS endpoints, including [authenticateCustomer](https://developer.salesforce.com/docs/commerce/commerce-api/references/auth?meta=authenticateCustomer), communicate with the associated B2C Commerce instance. If the instance is unavailable, calls to these endpoints will fail.

- [SCAPI hooks](/docs/commerce/b2c-commerce/guide/extensibility_via_hooks.html) including hooks on `dw.ocapi.shop.customer.auth.*` can conflict with SLAS calls. If SLAS calls are unexpectedly failing, check your B2C Commerce logs for hook invocation errors.

- If a shopper account associated with an access token is disabled or deleted, any subsequent requests made with that access token will fail.

- SLAS is capable of handling a maximum of 30 Custom Object scopes. For details, see [Shopper Custom Objects API.](https://developer.salesforce.com/docs/commerce/commerce-api/references/shopper-custom-objects?meta=Summary)

- In B2C Commerce, SLAS functions as a multi-tenant service that serves both PRD and non-PRD instances from its production environment. SLAS treats PRD and non-PRD instances as different "entities", and prioritizes production environment performance by minimizing the potential impact of non-PRD traffic and events to production. As a result, there are SLAS differences between PRD and non-PRD environments, which will be resolved in the future. SLAS PRD and non-PRD differences include:

  - SLAS token revocation behavior after a shopper password or email change: In non-PRD environments, after changing a password or email, it is possible to issue a request using the previously issued SLAS token without receiving an error.
  - When a B2C commerce shopper is deleted, an event is sent to SLAS to delete the corresponding SLAS user. In rare instances, if the delete event does not reach SLAS, you must use [`deleteShopper`](https://developer.salesforce.com/docs/commerce/commerce-api/references/auth-admin?meta=deleteShopper) to delete the corresponding record in SLAS.
  - Overall eventing (using events to trigger and communicate between services): By default, eventing is only available in PRD instances, so unless this is configured in other environments, it is not available. To have your non-PRD instances evaluated for possible eventing enablement, contact your Customer Success Manager or Account Executive.

## Next Steps

If you haven’t already, set up your public SLAS clients or private SLAS clients by following the instructions in [Authorization for Shopper APIs](/docs/commerce/b2c-commerce/guide/authorization-for-shopper-apis.html) in the Get Started guides.

After setting up your SLAS clients, see the SLAS guides that cover how to use both the main SLAS API and the SLAS Admin API:

- [Public SLAS Client Use Cases](/docs/commerce/b2c-commerce/guide/slas-public-client.html) (main SLAS API)
- [Private SLAS Client Use Cases](/docs/commerce/b2c-commerce/guide/slas-private-client.html) (main SLAS API)
- [SLAS Identity Providers](/docs/commerce/b2c-commerce/guide/slas-identity-providers.html) (SLAS Admin API)

For more technical details on the capabilities of the SLAS APIs, explore the API specifications in the Reference section:

- [SLAS API](https://developer.salesforce.com/docs/commerce/commerce-api/references?meta=shopper-login\:Summary)
- [SLAS Admin API](https://developer.salesforce.com/docs/commerce/commerce-api/references?meta=slas-admin\:Summary)
