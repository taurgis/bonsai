OAuth 2.0

Attention!

**The Open Commerce API (OCAPI) is now deprecated.** The provisions described in our [versioning and deprecation policy](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/b2c-commerce-ocapi/versioninganddeprecationpolicy.html) fully apply. For all new projects and major refactoring work, use B2C Commerce API (SCAPI) as the default REST API. For additional details, refer to [Why Use SCAPI Instead of OCAPI](https://developer.salesforce.com/docs/commerce/commerce-api/guide/why-use-scapi.html).

# OCAPI OAuth 2.0

Copy as Markdown

View as Markdown

Copy URL to Markdown

The OAuth 2.0 protocol is used for authentication and authorization where the shopping customer context provided by [JWT](/docs/commerce/b2c-commerce/references/b2c-commerce-ocapi/jwt.html) doesn’t fit. When using the Data API in a server-to-server scenario, OAuth is used to authenticate requests in the context of a client ID, also known as a _Client Credentials Grant_. When using the Shop API or Data API in a scenario in which a _Business Manager user_ interacts with the system, OAuth is used to authenticate requests in the context of the user.

Note

This topic assumes that you’re familiar with OAuth 2.0. For more information, see the [OAuth 2.0 Authorization Framework](http://tools.ietf.org/html/rfc6749) IETF specification.

## Supported Grant Types 

*   In a _server-to-server scenario_, one system, such as a CRM (Customer Relationship Management) application, interacts directly with the Data API: no end user interaction is required. In this scenario, the system requesting access functions as the OAuth 2.0 client application. This client application must be able to keep its client password secure. The OAuth 2.0 specification describes several authorization grant types. The server-to-server scenario makes use of the _client credentials grant_, used when the client application needs to access resources that aren’t owned by a specific resource owner or user. For more information, see the [Client Credentials Grant](http://tools.ietf.org/html/rfc6749#section-4.4) section in the IETF specification.
*   In other scenarios, requests must be authenticated for a _Business Manager user_, for which OCAPI supports a _Business Manager user grant_. This grant type is used by the Shop API for use cases in which a user does something on behalf of a shopping customer, for example the creation and submission of a basket. The Shop API allows such a user to do more than a customer authenticated with [JWT](/docs/commerce/b2c-commerce/references/b2c-commerce-ocapi/jwt.html), such as adding price adjustments to the basket. This grant type can also be used to authenticate requests to the Data API. The authenticated user needs to be authorized by assigning permissions in the Business Manager permissions module. Additionally the OAuth 2.0 Authorization Code Grant can be used for this scenario. For more information, see the [Authorization Code Grant](http://tools.ietf.org/html/rfc6749#section-1.3.1) section in the IETF specification.

## Basic Steps for Authentication and Authorization 

Perform the following steps:

1.  **Register your client application using Account Manager:**

    All client applications that access the Open Commerce API must be registered through the Account Manager. See Adding a client ID for the Open Commerce API. The result of this process is a set of values (a client ID and client password) that are known to both Commerce Cloud Digital and your client application.

Note

Digital doesn’t keep a copy of your client password; instead, it stores a one-way hash.

2.  **Request an access token:**

    The Digital Authorization server is a central server (account.demandware.com) that functions as an OAuth 2.0 authorization server from which the client can obtain an access token. The mechanism to obtain an access token depends on which sort of grant type you need. In the case of a Business Manager user grant the _Digital Application Server_ forwards the request for a token to the Authorization server.

3.  **Include the access token in the OCAPI request:**

    After your client application obtains an access token, it sends the token in each Open Commerce API request as part of the HTTP Authorization header.

## Requesting an Access Token With the Client ID and Password 

Before your client application can request an access token, you must first register with the Account Manager. When the registration is complete, the Account Manager provides you with a client ID. You need this client ID and your associated password (which you provided during registration) when coding your confidential web application. On sandboxes you can use the demo client ID “\[your\_own\_client\_id\]” with client password “\[your\_own\_client\_id\]”.

After registration, you can construct a request for the access token. Your client application then sends the token request to the Digital Authorization Server. Assuming the request succeeds, the Digital Authorization Server returns an access token. Your client application uses this token in following requests.

When the access token expires, the client application repeats the process.

Note

In addition to obtaining the access token, you must configure [client permissions](/docs/commerce/b2c-commerce/references/b2c-commerce-ocapi/ocapisettings.html) in order to grant your client application access to the Open Commerce APIs. When using a Business Manager user grant the user will also be checked against the Business Manager permissions set.

As described in the OAuth 2.0 specification, any access token request is an HTTP POST using transport layer security and the body is URL encoded.

*   **Obtain a Client Credentials grant:** in a request directed to the _Digital Authorization server_, the _Client ID_ and _client password_ are included in the _Authorization_ header as required by the [HTTP Basic Authentication mechanism (RFC 2617)](http://www.ietf.org/rfc/rfc2617.txt). (The client ID and client password, joined by a ’:’ are encoded using the base-64 encoding scheme.) The parameter _grant\_type_ is required and must be set to ‘client\_credentials’. See the sample below:

    ```txt
    REQUEST:
    POST /dwsso/oauth2/access_token HTTP/1.1
    Host: account.demandware.com
    Authorization: Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==
    Content-Type: application/x-www-form-urlencoded

    grant_type=client_credentials
    ```

*   **Obtain a Business Manager user grant:** in a request directed to the _Digital Application Server_, the _Client ID_ is included as a URL Parameter and the _User Login_, _User Password_ and _client password_ are included in the _Authorization_ header as required by the [HTTP Basic Authentication mechanism (RFC 2617)](http://www.ietf.org/rfc/rfc2617.txt). The joined

    ```txt
    User Login:User Password:Client Password
    ```

    is encoded using the base-64 encoding scheme. The parameter _grant\_type_ is required and must be set to

    ```txt
    urn:demandware:params:oauth:grant-type:client-id:dwsid:dwsecuretoken
    ```

    See the sample below:

    ```txt
    REQUEST:
    POST /dw/oauth2/access_token?client_id=[your_own_client_id] HTTP/1.1
    Host: example.com
    Authorization: Basic TXlMb2dpbjpNeVBhc3N3cmQ6TXlDbGllbnRTZWNyZXQ=
    Content-Type: application/x-www-form-urlencoded

    grant_type=urn:demandware:params:oauth:grant-type:client-id:dwsid:dwsecuretoken
    ```

Note

If the [Access Setting](https://help.salesforce.com/s/articleView?id=cc.b2c_ip_address_settings.htm&type=5) is configured in B2C Commerce Business Manager for **IP Range Allowlist**, it affects the OAuth grant type **Business Manager user grant**. An **unauthorized\_client** error is returned when a request to `/access_token` is made from an origin that is not in the allowlist. Any origin that wants to use OAuth must be in the allowlist.

*   **Obtain a Authorization Code Grant:** Login into the Digital Authorization server with the following request:

```txt
REQUEST:
GET /dwsso/oauth2/authorize?client_id=abcdef&amp;redirect_uri=http://myserver.com&amp;response_type=code HTTP/1.1
Host: account.demandware.com
```

Note:

1.  Your user on the Digital Authorization server need to have the role Business Manager Administrator or Business Manager User assigned together with a tenant filter, which matches the Digital Application Server instance you will use the OAuth token for.

2.  Please make sure, that the redirect URI given in your request matches the one defined at your client id, you are using at the Digital Authorization server.

As a result you will be redirected to the URL:

```txt
RESPONSE:
http://myserver.com&amp;code=g0ZGZmNjVmOWIjNTk2NTk4ZTYyZGI3
```

The redirect call will give you back the code created by the Digital Authorization server. In a second request directed to the Digital Authorization server, the the client ID and client password are included in the Authorization header, according to the HTTP Basic Authentication mechanism. The parameter `grant_type` is requiredand must be set to `authorization_code`. Additionally the code parameter value, returned from the first call and the `redirect_uri` needs to be provided. See the sample below:

```txt
REQUEST:

POST /dwsso/oauth2/access_token HTTP/1.1
Host: account.demandware.com
Authorization: Basic YWJjZGVmOm9wZW4gc2VzYW1l
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&amp;code=g0ZGZmNjVmOWIjNTk2NTk4ZTYyZGI3&amp;redirect_uri=http://myserver.com>
```

## Requesting an Access Token Using a JWT and Key Pair 

You can authenticate a client application using a signed JWT instead of an ID and password. Because the client password isn’t transferred, it isn’t vulnerable to interception. The signed JWT can’t be tampered with. This method is based on the [JWT Profile for OAuth 2.0 Client Authentication and Authorization Grants](https://tools.ietf.org/html/rfc7523).

1.  Generate a private and public key pair.

2.  Log into Account Manager and create an API Client. See Adding a client ID for the Open Commerce API.

3.  Generate a X.509 certificate with the following command:

    ```txt
    openssl req -x509 -newkey rsa:4096 -keyout key.pem -out
            cert.pem -days 365 -nodes
    ```

4.  Upload either a base64-encoded X.509 certificate containing the public key, or the Base64-encoded public key itself, to the **JWT (Client JWT Bearer Public Key)** section.

5.  For **Token Endpoint Auth Method**, select `private_key_jwt`.

6.  Create the JWT for requesting access tokens and sign it with the private key. The JWT format is described in the JWT Profile specification. Here’s an example.

    ```json
    # header
    {
      "alg": "RS256",
      "typ": "JWT"
    }

    # payload
    {
      "iss": "[your_own_client_id]",           // string identifying the issuing client app
      "sub": "[your_own_client_id]",   // string identifying the issuing client app
      "exp": 1548407254, // must be not more than 30 minutes in future
      "aud": "https://account.demandware.com:443/dwsso/oauth2/access_token"
    }
    ```

Use the JWT to obtain a client credentials grant via the `access_token` endpoint. Set the parameter `grant_type` to `client_credentials` and include the JWT in the `client_assertion` as in the example.

```txt
REQUEST:
POST /dwsso/oauth2/access_token HTTP/1.1
Host: account.demandware.com
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_assertion_type=urn%3Aietf%3Aparams%3Aoauth%3Aclient-assertion-type%3Ajwt-bearer
&client_assertion=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.
  eyJhdWQ[...omitted for brevity...].
  SmyAXw2[...omitted for brevity...]
```

Note

Using a Bearer JWT as an authorization grant with ‘`grant_type`’ value ‘`urn:ietf:params:oauth:grant-type:jwt-bearer`’ as described in [Using JWTs as Authorization Grants](https://tools.ietf.org/html/rfc7523#section-2.1) isn’t supported.

## Token Response 

When your client application requests an access token, the Digital Authorization Server returns a JSON document. If your request is valid, the client authentication succeeds, and the server’s response includes the access token:

```txt
RESPONSE:
HTTP/2 200 OK
Content-Type: application/json; charset=UTF-8
Cache-Control: no-store

{
 "access_token": "eyJhbG[...omitted for brevity]",
 "expires_in": 1800,
 "refresh_expires_in": 0,
 "token_type": "Bearer",
 "not-before-policy": 0,
 "scope": "mail"
}
```

## Token Expiration 

An access token obtained with Client Credentials grant expires after 30 minutes. In contrast, a token obtained with a Business Manager user grant expires after only 15 minutes. When an access token obtained using the client credentials grant expires, the client application has to request another access token.

Note

In order to ensure optimal client application performance an access token should be reused by the client application until it expires.

## Calling the Shop or Data API 

In your OCAPI request, include the access token as an _Authorization_ header ‘`Bearer`’ token:

```txt
REQUEST:
GET /dw/data/v24_5/customers/dude0815 HTTP/1.1
Host: example.com
Authorization: Bearer 5294ed7a-18dd-4ce7-ab9e-3ecda4c54f28
```
