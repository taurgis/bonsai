Create basket

Attention!

**The Open Commerce API (OCAPI) is now deprecated.** The provisions described in our [versioning and deprecation policy](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/b2c-commerce-ocapi/versioninganddeprecationpolicy.html) fully apply. For all new projects and major refactoring work, use B2C Commerce API (SCAPI) as the default REST API. For additional details, refer to [Why Use SCAPI Instead of OCAPI](https://developer.salesforce.com/docs/commerce/commerce-api/guide/why-use-scapi.html).

Create basket

Operation ID: Create basket

POST

https://{host}/s/{siteId}/dw/shop/v25\_6/baskets

Creates a new basket. The created basket is initialized with default values. Data provided in the body document will be populated into the created basket. Query parameter `temporary` can be set to `true` to create a temporary basket for the customer. The default value is `false` . Temporary baskets are separate from shopper storefront and agent baskets, and are intended for use to perform calculations or create an order without disturbing a shopper's open storefront basket. Temporary baskets are automatically deleted after a short time (15 minutes). A temporary basket can be identified with the property `temporary_basket` , which is `true` for temporary basket and `false` otherwise. Temporary baskets are available to all shoppers including guests (unlike agent baskets). All functionality that exists for a basket also applies to a temporary basket.
A basket can be updated with further Shop API calls. Considered values from the request body are:

*   customer information: PUT /baskets/{basket\_id}/customer
*   billing address: PUT /baskets/{basket\_id}/billing\_address
*   shipments including shipping address and shipping method: POST /baskets/{basket\_id}/shipments
*   product items: POST /baskets/{basket\_id}/items
*   coupon items: POST /baskets/{basket\_id}/coupons
*   Invalid coupons are silently ignored.
*   gift certificate items: POST /baskets/{basket\_id}/gift\_certificates
*   payment method and card type: POST /baskets/{basket\_id}/payment\_instruments
*   custom properties: PATCH /baskets/{basket\_id}

Related resource means with which resource you can specify the same data after the basket creation. Identify the basket using the `basket_id` property, which should be integrated into the path of an update request, for example a POST to `/baskets/{basket_id}/items` . The resource supports JWT or OAuth tokens for authentication:

*   A customer must provide a JWT which specifies exactly one customer (it may be a guest or a registered customer). In this case the resource creates a basket for this customer.
*   An agent must provide an OAuth token. The agent can use this resource to create a basket for a newly created guest customer, and can later update the customer if desired.

The number of baskets which can be created per customer is limited. When a basket is created it is said to be _open_ . It remains _open_ until either an order is created from it using a POST to resource `/orders` or it is _deleted_ using a DELETE to resource `/baskets/{basket_id}` . The number of _open_ baskets allowed depends on the authentication method used and the type of basket:

*   When using JWT each customer can have just 1 _open_ basket. In addition, each customer can have up to 4 _open temporary_ baskets (by default).
*   When using OAuth each customer can have up to 4 _open_ baskets. These baskets can be temporary baskets or a mix of storefront and temporary baskets.

Custom properties in the form c\_ < CUSTOM\_NAME > are supported. A custom property must correspond to a custom attribute ( < CUSTOM\_NAME > ) defined for the Basket system object, and its value must be valid for that custom attribute. Other basket properties like the channel type or source code cannot be set with this resource.

This endpoint may return the following faults:

*   400 - CustomerBasketsQuotaExceededException - Thrown if a new basket cannot be created because the maximum number of baskets per customer would be exceeded.
*   400 - CustomerTemporaryBasketsQuotaExceededException - Thrown if a new temporary basket cannot be created because the maximum number of temporary baskets per customer would be exceeded.
*   400 - DuplicateShipmentIdException - Indicates that the same shipment id appeared twice in the body.
*   400 - InvalidCustomerException - Thrown if the customerId URL parameter does not match the verified customer represented by the JWT, not relevant when using OAuth.
*   400 - InvalidPaymentMethodIdException - Indicates that the provided payment method is invalid or not applicable.
*   400 - InvalidPriceAdjustmentLevelException - Indicates that a fixed price adjustment was added at order level which is disallowed.
*   400 - InvalidPromotionIdException - When attempting to add a price adjustment, indicates that a promotion id was used twice.
*   400 - MissingCouponCodeException - Thrown if the coupon number is not provided.
*   400 - SystemPromotionIdException - When attempting to add a price adjustment, indicates that a system promotion id was used as a manual promotion id.
*   400 - TooManyPromotionsException - Indicates that more than one hundred price adjustments would have been created.
*   404 - ShipmentNotFoundException - Thrown if the shipment with the given shipment id is unknown.

Request

`curl "https://{host}/s/{siteId}/dw/shop/v25_6/baskets" \ -X POST \ -H "content-type: application/json" \ -d '{ "basket_id": "bczFTaOjgEqUkaaadkvHwbgrP5", "currency": "USD", "customer_info": { "customer_id": "adNJrbxJovaT5DPxUSfOywk6Et", "email": "" }, "order_total": 0, "product_sub_total": 0, "product_total": 0, "shipments": [ { "id": "me", "shipment_id": "bc5OTaOjgEqUoaaadkvHwbgrP5" } ], "shipping_items": [ { "item_id": "bcwsbaOjgEqUsaaadkvHwbgrP5", "shipment_id": "me" } ], "shipping_total": 0, "shipping_total_tax": 0, "tax_total": 0, "taxation": "net" }'`

Security

## Basic Authentication

User authentication either for a registered or a guest customer (selectable in request body). Access via Base64 encoded customer:password string as 'Authorization: Basic' header.

## OAuth 2.0

Authentication flow with client ID and password with account manager.

### Settings

## Api Key

Add client ID for application identification. Alternative as 'client\_id' query parameter.

Query parameters

false

| Field | Type | Description |
| --- | --- | --- |
| temporary | boolean | The boolean flag for creating the basket as temporary. |

Body

Media type:

application/jsontext/xml      `{   "basket_id": "bczFTaOjgEqUkaaadkvHwbgrP5",   "currency": "USD",   "customer_info": {     "customer_id": "adNJrbxJovaT5DPxUSfOywk6Et",     "email": ""   },   "order_total": 0,   "product_sub_total": 0,   "product_total": 0,   "shipments": [     {       "id": "me",       "shipment_id": "bc5OTaOjgEqUoaaadkvHwbgrP5"     }   ],   "shipping_items": [     {       "item_id": "bcwsbaOjgEqUsaaadkvHwbgrP5",       "shipment_id": "me"     }   ],   "shipping_total": 0,   "shipping_total_tax": 0,   "tax_total": 0,   "taxation": "net" }`

| Field | Type | Description |
| --- | --- | --- |
| adjusted_merchandize_total_tax | double | The products tax after discounts applying in purchase currency. Adjusted merchandize prices represent the sum of product prices before services such as shipping have been added, but after adjustment from promotions have been added. |
| adjusted_shipping_total_tax | double | The tax of all shipping line items of the line item container after shipping adjustments have been applied. |
| agent_basket | boolean | Is the basket created by an agent? |
| basket_id | string | The unique identifier for the basket. |
| billing_address | object | Document representing an order address. — Enum values: CADEUS |
| bonus_discount_line_items | array | The bonus discount line items of the line item container. |
| coupon_items | array | The sorted array of coupon items. This array can be empty. — Maximum characters: 256, Enum values: coupon_code_already_in_basketcoupon_code_already_redeemedcoupon_code_unknowncoupon_disabledredemption_limit_exceededcustomer_redemption_limit_exceededtimeframe_redemption_limit_exceededno_active_promotioncoupon_already_in_basketno_applicable_promotionappliedadhoc |
| currency | string | The ISO 4217 mnemonic code of the currency. |
| customer_info | object | Document representing information used to identify a customer. — Maximum characters: 100, Maximum characters: 100 |
| gift_certificate_items | array | The sorted array of gift certificate line items. This array can be empty. — Maximum characters: 4000, Minimum characters: 1 |
| grouped_tax_items | array | Tax values that are summed and grouped based on the tax rate. The tax totals of the line items with the same tax rate will be grouped together and summed up. This will not affect calculation in any way. |
| inventory_reservation_expiry | datetime |  |
| merchandize_total_tax | double | The products total tax in purchase currency. Merchandize total prices represent the sum of product prices before services such as shipping or adjustment from promotions have been added. |
| notes | object | Document representing a link to another resource. |
| order_price_adjustments | array | The array of order level price adjustments. This array can be empty. — Enum values: BACKORDEREVEN_EXCHANGEPRICE_MATCH |
| order_total | double | The total price of the order, including products, shipping and tax. This property is part of basket checkout information only. |
| payment_instruments | array | The payment instruments list for the order. — Maximum characters: 256, Maximum characters: 256 |
| product_items | array | The sorted array of product items (up to a maximum of 50 items by default). This array can be empty. — Maximum characters: 256, Maximum characters: 100, Min value: 0 |
| product_sub_total | double | The total price of all product items after all product discounts. Depending on taxation policy the returned price is net or gross. |
| product_total | double | The total price of all product items after all product and order discounts. Depending on taxation policy the returned price is net or gross. |
| shipments | array | The array of shipments. This property is part of basket checkout information only. — Enum values: not_shippedshipped |
| shipping_items | array | The sorted array of shipping items. This array can be empty. |
| shipping_total | double | The total shipping price of the order after all shipping discounts. Excludes tax if taxation policy is net. Includes tax if taxation policy is gross. This property is part of basket checkout information only. Includes tax if taxation policy is gross. |
| shipping_total_tax | double | The tax of all shipping line items of the line item container before shipping adjustments have been applied. |
| source_code | string | Gets the source code assigned to this basket. |
| tax_rounded_at_group | boolean | If the tax is rounded at group level then this is set to true, false if the tax is rounded at item or unit level |
| tax_total | double | The total tax amount of the order. This property is part of basket checkout information only. |
| taxation | string | The taxation the line item container is based on. — Enum values: grossnet |
| temporary_basket | boolean | Is the basket created a temporary basket? |

Responses

400

404

default

`CustomerBasketsQuotaExceededException` - Thrown if a new basket cannot be created because the maximum number of baskets per customer would be exceeded. or `CustomerTemporaryBasketsQuotaExceededException` - Thrown if a new temporary basket cannot be created because the maximum number of temporary baskets per customer would be exceeded. or `DuplicateShipmentIdException` - Indicates that the same shipment id appeared twice in the body. or `InvalidCustomerException` - Thrown if the customerId URL parameter does not match the verified customer represented by the JWT, not relevant when using OAuth. or `InvalidPaymentMethodIdException` - Indicates that the provided payment method is invalid or not applicable. or `InvalidPriceAdjustmentLevelException` - Indicates that a fixed price adjustment was added at order level which is disallowed. or `InvalidPromotionIdException` - When attempting to add a price adjustment, indicates that a promotion id was used twice. or `MissingCouponCodeException` - Thrown if the coupon number is not provided. or `SystemPromotionIdException` - When attempting to add a price adjustment, indicates that a system promotion id was used as a manual promotion id. or `TooManyPromotionsException` - Indicates that more than one hundred price adjustments would have been created.

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
