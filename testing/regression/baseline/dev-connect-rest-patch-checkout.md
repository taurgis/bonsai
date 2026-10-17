## Commerce Webstore Checkout

Update a Commerce store checkout.

If a store is segmented into markets, this API looks at the language parameter appended to the URL to determine the shopper’s locale and returns the appropriate values.

_Available in: v55.0_

If you want to use this resource with a WebStore of type B2CE, open a case with Salesforce Support and provide this information: Salesforce organization ID Tenant ID (You can find this ID on the Manage Cloud-to-Cloud Connections page in Setup) B2C Commerce Business Manager login URL B2C Commerce site IDs

**Note**: During the checkout process, you must make a GET request to `/commerce/webstores/{webstoreId}/checkouts/{activeOrCheckoutId}` or `/commerce/webstores/{webstoreId}/checkouts/{checkoutId}` at least once after making a PATCH request to `/commerce/webstores/{webstoreId}/checkouts`. We recommend continuously polling the GET request until the API returns a `200 OK` status, indicating that the response is ready for consumption.

**Note:** To resolve a [409](/docs/platform/connect-rest-api/guide/connect_error_responses) error returned on a PATCH or DELETE request, retry your request until it returns a 2xx status with updated data. To avoid returning a 409 error on PATCH or DELETE requests, make sure that you don’t have any custom code that modifies the cart or a checkout session while calling PATCH or DELETE.

##### path Parameters

| webstoreIdrequired | string <Id> ^(0ZE)\w*The ID of the web store.Available in: v55.0 |
| --- | --- |
| activeOrCheckoutIdrequired | stringValues for {activeOrCheckoutId} are:{checkoutId} —ID of the checkout.active —Active checkout.Available in: v55.0 |

##### query Parameters

| effectiveAccountId | string <Id> ^(001)\w* |
| --- | --- |

##### Request Body schema: application/json

Input for a Commerce store checkout.

| contactInfo | object (CheckoutContactInfoV2Input)Checkout Contact Info Representation |
| --- | --- |
| customFields | Array of objectsCustom Fields |
| deliveryAddress | object (CheckoutAddressInputV2CommerceCheckout)Address input representation |
| deliveryMethodId | stringCheckout Delivery Method ID |
| desiredDeliveryDate | string <date-time>Checkout Desired Delivery Date |
| shippingInstructions | stringCheckout Shipping Instructions |

### Responses

**200**

Checkout

patch/commerce/webstores/{webstoreId}/checkouts/{activeOrCheckoutId}

API server for your Salesforce org.

https://{MyDomainName}.my.salesforce.com/services/data/v67.0/commerce/webstores/{webstoreId}/checkouts/{activeOrCheckoutId}

### Request samples

*   Payload
*   Example 1
*   Example 2
*   Example 3

Content type

application/json

Example

Payload 1Payload 2Payload 3Payload 1

Here’s an example of a request including contact information and Cart custom fields: The PATCH request fails if it includes contact information with Cart Delivery Group custom fields or with both Cart and Cart Delivery Group custom fields.

Copy

Expand all Collapse all

`{  *   "contactInfo": {          *   "firstName": "Alan",              *   "lastName": "Johnson",              *   "email": "al**@jo*****.com",              *   "phoneNumber": "******3944"                   },      *   "customFields": [          *   {                  *   "attributes": {                          *   "type": "WebCart"                                           },                      *   "Id": "0a6xx0000000000",                      *   "MyCustomTextField__c": "Foo",                      *   "MyCustomNumberField__c": 12.34,                      *   "MyCustomPercentField__c": 0.2345,                      *   "MyCustomGeolocationField__c": {                          *   "latitude": 33.345,                              *   "longitude": 45.567                                           }                               }                   ]       }`

### Response samples

*   200

Content type

application/json

Example

Payload 1Payload 2Payload 1

Here’s an example for POST.

Copy

`{  *   "checkoutId": "2z9R000000008LfIAI"       }`
