Register customer

Attention!

**The Open Commerce API (OCAPI) is now deprecated.** The provisions described in our [versioning and deprecation policy](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/b2c-commerce-ocapi/versioninganddeprecationpolicy.html) fully apply. For all new projects and major refactoring work, use B2C Commerce API (SCAPI) as the default REST API. For additional details, refer to [Why Use SCAPI Instead of OCAPI](https://developer.salesforce.com/docs/commerce/commerce-api/guide/why-use-scapi.html).

Register customer

Operation ID: Register customer

POST

https://{host}/s/{siteId}/dw/shop/v25\_6/customers

Registers a customer.

You must specify the login credentials, last name, and email address. This method ignores all other data, which can only be set for an existing customer. To set other values, make calls after the customer is created.

When using OAuth, don't include the password in the request. In this case, including the password throws an `InvalidPasswordException` .

When using JWT, the password is required.

Also returns the hashedLoginId for Einstein use cases.

Note: If customers are created using OCAPI call then any updated to the customer records should be done through OCAPI calls as well. The customer records created with Script API call should not be updated with OCAPI calls as the email validation is handled differently in these calls and may result in InvalidEmailException.

This endpoint may return the following faults:

*   400 - CustomerAlreadyRegisteredException - Indicates that the resource is called with JWT representing a registered customer.
*   400 - InvalidLoginException - Indicates that login doesn't match acceptance criteria.
*   400 - InvalidPasswordException - Indicates that password doesn't match acceptance criteria.
*   400 - LoginAlreadyInUseException - Indicates that the given login is already used.
*   400 - MissingEmailException - Indicates that request document does not contain email.
*   400 - MissingLastNameException - Indicates that request document does not contain last\_name.
*   400 - MissingLoginException - Indicates that request document does not contain login.
*   400 - MissingPasswordException - Indicates that password was not provided in JWT scenario.

Request

`curl "https://{host}/s/{siteId}/dw/shop/v25_6/customers" \ -X POST \ -H "content-type: application/json" \ -d '{ "customer": { "email": "jsmith@test.com", "last_name": "Smith", "login": "jsmith" }, "password": "12345!aBcD" }'`

Security

## Basic Authentication

User authentication either for a registered or a guest customer (selectable in request body). Access via Base64 encoded customer:password string as 'Authorization: Basic' header.

## OAuth 2.0

Authentication flow with client ID and password with account manager.

### Settings

## Api Key

Add client ID for application identification. Alternative as 'client\_id' query parameter.

Body

Media type:

application/jsontext/xml      `{   "customer": {     "email": "[jsmith@test.com](mailto:jsmith@test.com)",     "last_name": "Smith",     "login": "jsmith"   },   "password": "12345!aBcD" }`

| Field | Type | Description |
| --- | --- | --- |
| customer | object | Document representing a customer. — Enum values: guestregistered, Maximum characters: 256, Maximum characters: 100, Maximum characters: 256, Maximum characters: 32, Maximum characters: 256, Enum values: 12, Maximum characters: 256, Maximum characters: 256, Maximum characters: 256, Maximum characters: 32, Maximum characters: 32, Maximum characters: 32, Maximum characters: 256, Maximum characters: 256, Maximum characters: 256, Maximum characters: 256 |
| password | string | The password to authorize. — Maximum characters: 4096 |

Responses

400

default

`CustomerAlreadyRegisteredException` - Indicates that the resource is called with JWT representing a registered customer. or `InvalidLoginException` - Indicates that login doesn't match acceptance criteria. or `InvalidPasswordException` - Indicates that password doesn't match acceptance criteria. or `LoginAlreadyInUseException` - Indicates that the given login is already used. or `MissingEmailException` - Indicates that request document does not contain email. or `MissingLastNameException` - Indicates that request document does not contain last\_name. or `MissingLoginException` - Indicates that request document does not contain login. or `MissingPasswordException` - Indicates that password was not provided in JWT scenario.

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
