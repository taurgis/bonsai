Get order

Attention!

**The Open Commerce API (OCAPI) is now deprecated.** The provisions described in our [versioning and deprecation policy](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/b2c-commerce-ocapi/versioninganddeprecationpolicy.html) fully apply. For all new projects and major refactoring work, use B2C Commerce API (SCAPI) as the default REST API. For additional details, refer to [Why Use SCAPI Instead of OCAPI](https://developer.salesforce.com/docs/commerce/commerce-api/guide/why-use-scapi.html).

Get order

Operation ID: Get order

GET

https://{host}/s/{siteId}/dw/shop/v25\_6/orders/{order\_no}

Gets information for an order.

This endpoint may return the following faults:

*   404 - OrderNotFoundException - Indicates that the order with the given order number is unknown.

Request

`curl "https://{host}/s/{siteId}/dw/shop/v25_6/orders/{order_no}"`

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
| order_no | string | the order number — Minimum characters: 1 |

Responses

404

default

`OrderNotFoundException` - Indicates that the order with the given order number is unknown.

      `{   "arguments": {},   "cause": {     "cause": "",     "message": "",     "type": ""   },   "display_message_pattern": "",   "message": "",   "stack_trace": "",   "type": "" }`

Body

Media type:

application/jsontext/xml

false

| Field | Type | Description |
| --- | --- | --- |
| arguments | object | A map that provides fault arguments. Data can be used to provide error messages on the client side. |
| cause | object |  |
| display_message_pattern | string | The localized display message pattern, if the request parameter display_locale was given |
| message | string | The message text of the java exception. |
| stack_trace | string |  |
| type | string | The name of the java exception. |
