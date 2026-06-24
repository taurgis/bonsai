Create customer

Attention!

**The Open Commerce API (OCAPI) is now deprecated.** The provisions described in our [versioning and deprecation policy](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/b2c-commerce-ocapi/versioninganddeprecationpolicy.html) fully apply. For all new projects and major refactoring work, use B2C Commerce API (SCAPI) as the default REST API. For additional details, refer to [Why Use SCAPI Instead of OCAPI](https://developer.salesforce.com/docs/commerce/commerce-api/guide/why-use-scapi.html).

Create customer

Operation ID: Create customer

POST

https://{host}/s/-/dw/data/v25\_6/customer\_lists/{list\_id}/customers

Action to create a new customer. The customer is created using the specified credentials and customer information.This action verifies the following:

*   Login acceptance criteria and uniqueness
*   Mandatory customer properties

If the action fails to create the customer, it returns a 400 fault with an appropriate message.

This endpoint may return the following faults:

*   400 - CredentialsMissingException - Indicates that the mandatory credentials are missing in the input document.
*   400 - InvalidLoginException - Indicates the login does not match the login acceptance criteria.
*   400 - LoginAlreadyInUseException - Indicates the login is already in use.
*   400 - LoginMissingException - Indicates that the mandatory login property is missing in the input document.
*   404 - CustomerListNotFoundException - Indicates that the customer list with the given customer list id is unknown.

Request

`curl "https://{host}/s/-/dw/data/v25_6/customer_lists/{list_id}/customers" \ -X POST \ -H "content-type: application/json" \ -d '{ "birthday": "1970-01-31", "company_name": "Salesforce B2C Commerce", "creation_date": "2013-09-17T09:20:31.000Z", "credentials": { "enabled": true, "locked": false, "login": "dude", "password_question": "Mother's maiden name" }, "customer_no": "0815", "email": "dude@salesforce.com", "fax": "001-444-4444", "first_name": "Dude", "job_title": "", "last_name": "Lebowski", "phone_business": "001-222-2222", "phone_home": "001-111-1111", "phone_mobile": "001-333-3333", "preferred_locale": "de_DE", "salutation": "Mr.", "second_name": "second", "suffix": "suffix", "title": "Dr." }'`

Security

## OAuth 2.0

Authentication flow with client ID and password with account manager.

### Settings

URI parameters

false

| Field | Type | Description |
| --- | --- | --- |
| list_id | string | The customer list id — Minimum characters: 1 |

Body

Media type:

application/jsontext/xml      `{   "birthday": "1970-01-31",   "company_name": "Salesforce B2C Commerce",   "creation_date": "2013-09-17T09:20:31.000Z",   "credentials": {     "enabled": true,     "locked": false,     "login": "dude",     "password_question": "Mother's maiden name"   },   "customer_no": "0815",   "email": "[dude@salesforce.com](mailto:dude@salesforce.com)",   "fax": "001-444-4444",   "first_name": "Dude",   "job_title": "",   "last_name": "Lebowski",   "phone_business": "001-222-2222",   "phone_home": "001-111-1111",   "phone_mobile": "001-333-3333",   "preferred_locale": "de_DE",   "salutation": "Mr.",   "second_name": "second",   "suffix": "suffix",   "title": "Dr." }`

| Field | Type | Description |
| --- | --- | --- |
| birthday | date | The customer's birthday. |
| company_name | string | The customer's company name. — Maximum characters: 256 |
| credentials | object | Document representing the credentials of a customer. — Maximum characters: 256, Maximum characters: 256 |
| customer_id | string | The customer's id. Both registered and guest customers have a customer id. — Maximum characters: 28 |
| customer_no | string | The customer's number. — Maximum characters: 100 |
| email | string | The customer's email address. — Maximum characters: 256 |
| fax | string | The fax number to use for the customer. The length is restricted to 32 characters. — Maximum characters: 32 |
| first_name | string | The customer's first name. — Maximum characters: 256 |
| gender | integer | The customer's gender. — Enum values: 12 |
| global_party_id | string | The Global Party ID is set by Customer 360 and identifies a person across multiple systems. |
| job_title | string | The customer's job title. — Maximum characters: 256 |
| last_name | string | The customer's last name. — Maximum characters: 256 |
| phone_business | string | The customer's business phone number. — Maximum characters: 32 |
| phone_home | string | The customer's home phone number. — Maximum characters: 32 |
| phone_mobile | string | The customer's mobile phone number. — Maximum characters: 32 |
| previous_login_time | datetime | The time when the customer logged in previously. |
| previous_visit_time | datetime | The time when the customer previously visited the store. |
| primary_address | object | Document representing a customer address. — Maximum characters: 256, Maximum characters: 256, Maximum characters: 256, Maximum characters: 256, Maximum characters: 256, Maximum characters: 2, Enum values: CADEUS, Maximum characters: 256, Maximum characters: 256, Maximum characters: 256, Maximum characters: 32, Maximum characters: 256, Maximum characters: 256, Maximum characters: 256, Maximum characters: 256, Maximum characters: 256, Maximum characters: 256, Maximum characters: 32, Maximum characters: 256 |
| salutation | string | The customer's salutation. — Maximum characters: 256 |
| second_name | string | The customer's second name. — Maximum characters: 256 |
| suffix | string | The customer's suffix (for example, "Jr." or "Sr."). — Maximum characters: 256 |
| title | string | The customer's title (for example, "Mrs" or "Mr"). — Maximum characters: 256 |

Responses

400

404

default

`CredentialsMissingException` - Indicates that the mandatory credentials are missing in the input document. or `InvalidLoginException` - Indicates the login does not match the login acceptance criteria. or `LoginAlreadyInUseException` - Indicates the login is already in use. or `LoginMissingException` - Indicates that the mandatory login property is missing in the input document.

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
