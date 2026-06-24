Remove a basket

Attention!

**The Open Commerce API (OCAPI) is now deprecated.** The provisions described in our [versioning and deprecation policy](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/b2c-commerce-ocapi/versioninganddeprecationpolicy.html) fully apply. For all new projects and major refactoring work, use B2C Commerce API (SCAPI) as the default REST API. For additional details, refer to [Why Use SCAPI Instead of OCAPI](https://developer.salesforce.com/docs/commerce/commerce-api/guide/why-use-scapi.html).

Remove a basket

Operation ID: Remove a basket

DELETE

https://{host}/s/{siteId}/dw/shop/v25\_6/baskets/{basket\_id}

Removes a basket.

This endpoint may return the following faults:

*   400 - InvalidCustomerException - Indicates that the customer assigned to the basket does not match the verified customer represented by the JWT, not relevant when using OAuth.
*   404 - BasketNotFoundException - Indicates that the basket with the given basket id is unknown.

Request

`curl "https://{host}/s/{siteId}/dw/shop/v25_6/baskets/{basket_id}" \ -X DELETE`

Security

## Basic Authentication

User authentication either for a registered or a guest customer (selectable in request body). Access via Base64 encoded customer:password string as 'Authorization: Basic' header.

## OAuth 2.0

Authentication flow with client ID and password with account manager.

### Settings

## Api Key

Add client ID for application identification. Alternative as 'client\_id' query parameter.

URI parameters

false

| Field | Type | Description |
| --- | --- | --- |
| basket_id | string | the id of the basket to be retrieved — Minimum characters: 1 |

Responses

204

400

404

No description provided
