Get campaign

Attention!

**The Open Commerce API (OCAPI) is now deprecated.** The provisions described in our [versioning and deprecation policy](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/b2c-commerce-ocapi/versioninganddeprecationpolicy.html) fully apply. For all new projects and major refactoring work, use B2C Commerce API (SCAPI) as the default REST API. For additional details, refer to [Why Use SCAPI Instead of OCAPI](https://developer.salesforce.com/docs/commerce/commerce-api/guide/why-use-scapi.html).

Get Campaign

Operation ID: Get Campaign

GET

https://{host}/s/-/dw/data/v25\_6/sites/{site\_id}/campaigns/{campaign\_id}

Action to get campaign information.

This endpoint may return the following faults:

*   404 - CampaignNotFoundException - Thrown in case the campaign does not exist matching the given id

Request

`curl "https://{host}/s/-/dw/data/v25_6/sites/{site_id}/campaigns/{campaign_id}"`

Security

## OAuth 2.0

Authentication flow with client ID and password with account manager.

### Settings

URI parameters

false

| Field | Type | Description |
| --- | --- | --- |
| site_id | string | The site the requested campaign belongs to. — Minimum characters: 1 |
| campaign_id | string | The id of the requested campaign. — Minimum characters: 1 |

Responses

404

default

`CampaignNotFoundException` - Thrown in case the campaign does not exist matching the given id

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
