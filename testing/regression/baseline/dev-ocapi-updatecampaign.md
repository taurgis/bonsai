Update campaign

Attention!

**The Open Commerce API (OCAPI) is now deprecated.** The provisions described in our [versioning and deprecation policy](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/b2c-commerce-ocapi/versioninganddeprecationpolicy.html) fully apply. For all new projects and major refactoring work, use B2C Commerce API (SCAPI) as the default REST API. For additional details, refer to [Why Use SCAPI Instead of OCAPI](https://developer.salesforce.com/docs/commerce/commerce-api/guide/why-use-scapi.html).

Update Campaign

Operation ID: Update Campaign

PATCH

https://{host}/s/-/dw/data/v25\_6/sites/{site\_id}/campaigns/{campaign\_id}

Updates the campaign with the specified information.

This endpoint may return the following faults:

*   400 - CampaignDuplicateException - if a campaign exists already in the site with the given campaign id.
*   404 - CampaignNotFoundException - Thrown in case the campaign does not exist matching the given id

Request

`curl "https://{host}/s/-/dw/data/v25_6/sites/{site_id}/campaigns/{campaign_id}" \ -X PATCH \ -H "content-type: application/json" \ -d '{ "coupons": [ "testCoupon" ], "customer_groups": [ "Registered" ], "description": "My Campaign", "enabled": true, "end_date": "2015-07-31T23:09:08.000Z", "link": "https://example.com/s/-/dw/data/{version}/sites/SiteGenesis/campaigns/my-campaign", "source_code_groups": [ "WapiSourceCodeGroup1" ], "start_date": "2015-04-01T11:30:15.000Z" }'`

Security

## OAuth 2.0

Authentication flow with client ID and password with account manager.

### Settings

URI parameters

false

| Field | Type | Description |
| --- | --- | --- |
| site_id | string | The site context. — Minimum characters: 1 |
| campaign_id | string | The id of the requested campaign. — Minimum characters: 1 |

Body

Media type:

application/jsontext/xml      `{   "coupons": [     "testCoupon"   ],   "customer_groups": [     "Registered"   ],   "description": "My Campaign",   "enabled": true,   "end_date": "2015-07-31T23:09:08.000Z",   "link": "[https://example.com/s/-/dw/data/](https://example.com/s/-/dw/data/){version}/sites/SiteGenesis/campaigns/my-campaign",   "source_code_groups": [     "WapiSourceCodeGroup1"   ],   "start_date": "2015-04-01T11:30:15.000Z" }`

| Field | Type | Description |
| --- | --- | --- |
| campaign_id | string | The ID of the campaign. — Minimum characters: 1, Maximum characters: 256 |
| coupons | array of string | The array of assigned coupon IDs, not sorted |
| customer_groups | array of string | The array of assigned customer groups, not sorted |
| description | string | The description of the campaign. — Maximum characters: 4000 |
| enabled | boolean | The enabled flag for campaign. |
| end_date | datetime | The date that the Scenario ends |
| link | string | link for convenience |
| source_code_groups | array of string | The array of assigned source code groups, not sorted |
| start_date | datetime | The date that the Scenario begins |

Responses

400

404

default

`CampaignDuplicateException` - if a campaign exists already in the site with the given campaign id.

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
