# OCAPI Custom Properties

The Open Commerce API allows you to set custom properties of business objects in input documents and to read custom properties in output documents. Whether a business object supports custom properties can be found in the [tables below](#document-types-supporting-custom-properties).
Custom properties are always marked with the prefix `c_` and have therefore their own namespace.

## Custom Properties Example

The example below shows a document response including some custom properties in OCAPI:

```txt
REQUEST: GET /dw/shop/v24_5/products/creative-zen-v HTTP/1.1
Host: example.com
Accept: application/json

RESPONSE: HTTP/1.1 200 OK
Content-Type:  application/json; charset=UTF-8
Cache-Control:  max-age=900,must-revalidate
{
   ...
   "c_mediaFormat" : [ "0010", "0020", "0030", "0040" ],
   "c_memorySize" : "1GB",
   "c_tabDescription" : "The ZEN V player was designed for people like you those who walk a step or two ahead of the pack."
}
```

## Custom Properties Value Types

The following value types are supported in OCAPI for input and output of custom properties.

- Text
- String
- Enum of Strings
- Set of Strings
- Integer
- Enum of Integers
- Set of Integers
- Double
- Set of Doubles
- Boolean
- EMail
- Password
- Date
- Date+Time

:::note
The value types **HTML** and **Image** are only supported as output, but not as input value type for custom properties in OCAPI.
:::

## Document Types Supporting Custom Properties

The tables below lists the document types that support custom properties in OCAPI SHOP and DATA APIs. OCAPI `modify...` hooks that used the referenced document types can
add custom properties using the `c_` prefix. See [Customization With Hooks](https://developer.salesforce.com/docs/commerce/commerce-api/guide/extensibility_via_hooks.html), [Hooks for SHOP API](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/b2c-commerce-ocapi/hooks-shop.html), and [Hooks for DATA API](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/b2c-commerce-ocapi/hooks-data.html) for more information.

### SHOP API

The following shop API documents support custom properties.

| Document Type                    | Reference                                                                                                                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ApproachingDiscount              | [approaching_discount](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-baskets?meta=type%3Aapproaching_discount)                                 |
| Basket                           | [basket](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-baskets?meta=type%3Abasket)                                                             |
| BasketPaymentInstrumentRequest   | [basket_payment_instrument_request](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-baskets?meta=type%3Abasket_payment_instrument_request)       |
| BonusDiscountLineItem            | [bonus_discount_line_item](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-baskets?meta=type%3Abonus_discount_line_item)                         |
| BundledProductItem               | [bundled_product_item](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-customers?meta=type%3Abundled_product)                                    |
| Category                         | [category](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-categories?meta=type%3Acategory)                                                      |
| Content                          | [content](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-content?meta=type%3Acontent)                                                           |
| ContentFolder                    | [content_folder](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-folders?meta=type%3Acontent_folder)                                             |
| CouponItem                       | [coupon_item](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-baskets?meta=type%3Acoupon_item)                                                   |
| CustomObject                     | [custom_object](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-custom-objects?meta=type%3Acustom_object)                                        |
| Customer                         | [customer](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-customers?meta=type%3Acustomer)                                                       |
| CustomerAddress                  | [customer_address](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-customers?meta=type%3Acustomer_address)                                       |
| CustomerInfo                     | [customer_info](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-customers?meta=type%3Acustomer_info)                                             |
| CustomerPaymentInstrument        | [customer_payment_instrument](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-customers?meta=type%3Acustomer_payment_instrument)                 |
| CustomerPaymentInstrumentRequest | [customer_payment_instrument_request](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-customers?meta=type%3Acustomer_payment_instrument_request) |
| CustomerProductList              | [customer_product_list](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-customers?meta=type%3Acustomer_product_list)                             |
| CustomerProductListItem          | [customer_product_list_item](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-customers?meta=type%3Acustomer_product_list_item)                   |
| CustomerProductListItemPurchase  | [customer_product_list_item_purchase](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-customers?meta=type%3Acustomer_product_list_item_purchase) |
| GiftCertificate                  | [gift_certificate](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-gift-certificate?meta=type%3Agift_certificate)                                |
| GiftCertificateItem              | [gift_certificate_item](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-baskets?meta=type%3Agift_certificate_item)                               |
| OptionItem                       | [option_item](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-baskets?meta=type%3Aoption_item)                                                   |
| Order                            | [order](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-orders?meta=type%3Aorder)                                                                |
| OrderAddress                     | [order_address](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-orders?meta=type%3Aorder_address)                                                |
| OrderPaymentInstrument           | [order_payment_instrument](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-orders?meta=type%3Aorder_payment_instrument)                          |
| OrderPaymentInstrumentRequest    | [order_payment_instrument_request](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-orders?meta=type%3Aorder_payment_instrument_request)          |
| PathRecord                       | [path_record](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-categories?meta=type%3Apath_record)                                                |
| PaymentCardSpec                  | [payment_card_spec](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-baskets?meta=type%3Apayment_card_spec)                                       |
| PaymentMethod                    | [payment_method](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-baskets?meta=type%3Apayment_method)                                             |
| PriceAdjustment                  | [price_adjustment](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-baskets?meta=type%3Aprice_adjustment)                                         |
| PriceAdjustmentRequest           | [price_adjustment_request](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-baskets?meta=type%3Aprice_adjustment_request)                         |
| Product                          | [product](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-products?meta=type%3Aproduct)                                                          |
| ProductItem                      | [product_item](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-baskets?meta=type%3Aproduct_item)                                                 |
| ProductListItem                  | [product_list_item](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-baskets?meta=type%3Aproduct_list_item_reference)                             |
| ProductListItemReference         | [product_list_item_reference](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-baskets?meta=type%3Aproduct_list_item_reference)                   |
| ProductListLink                  | [product_list_link](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-baskets?meta=type%3Aproduct_list_link)                                       |
| ProductSearchHit                 | [product_search_hit](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-product-search?meta=type%3Aproduct_search_hit)                              |
| Promotion                        | [promotion](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-promotions?meta=type%3Apromotion)                                                    |
| PublicProductList                | [public_product_list](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-product-lists?meta=type%3Apublic_product_list)                             |
| PublicProductListItem            | [public_product_list_item](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-product-lists?meta=type%3Apublic_product_list_item)                   |
| PublicProductListLink            | [public_product_list_link](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-product-lists?meta=type%3Apublic_product_list_link)                   |
| Recommendation                   | [recommendation](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-products?meta=type%3Arecommendation)                                            |
| Shipment                         | [shipment](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-baskets?meta=type%3Ashipment)                                                         |
| ShippingItem                     | [shipping_item](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-baskets?meta=type%3Ashipping_item)                                               |
| ShippingMethod                   | [shipping_method](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-baskets?meta=type%3Ashipping_method)                                           |
| ShippingPromotion                | [shipping_promotion](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-baskets?meta=type%3Ashipping_promotion)                                     |
| Store                            | [store](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-stores?meta=type%3Astore)                                                                |
| SuggestedCategory                | [suggested_category](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-search-suggestion?meta=type%3Asuggested_category)                           |
| SuggestedContent                 | [suggested_content](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-search-suggestion?meta=type%3Asuggested_content)                             |
| SuggestedPhrase                  | [suggested_phrase](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-search-suggestion?meta=type%3Asuggested_phrase)                               |
| SuggestedProduct                 | [suggested_product](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-search-suggestion?meta=type%3Asuggested_product)                             |
| Suggestion                       | [suggestion](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-shop-search-suggestion?meta=type%3Asuggestion)                                           |

### DATA API

The following DATA API documents support custom properties.

| Document Type                   | Reference                                                                                                                                                                     |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Campaign                        | [campaign](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-data-campaigns?meta=type%3Acampaign)                                                  |
| Catalog                         | [catalog](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-data-catalogs?meta=type%3Acatalog)                                                     |
| Category                        | [category](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-data-catalogs?meta=type%3Acategory)                                                   |
| ContentAsset                    | [content_asset](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-data-libraries?meta=type%3Acontent_asset)                                        |
| ContentFolder                   | [content_folder](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-data-libraries?meta=type%3Acontent_folder)                                      |
| Coupon                          | [coupon](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-data-coupons?meta=type%3Acoupon)                                                        |
| CustomObject                    | [custom_object](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-data-custom-objects?meta=type%3Acustom_object)                                   |
| Customer                        | [customer](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-data-customer-lists?meta=type%3Acustomer)                                             |
| CustomerAddress                 | [customer_address](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-data-customer-lists?meta=type%3Acustomer_address)                             |
| CustomerGroup                   | [customer_group](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-data-customer-group-search?meta=type%3Acustomer_group)                          |
| GiftCertificate                 | [gift_certificate](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-data-gift-certificates?meta=type%3Agift_certificate)                          |
| OrderUpdateRequest              | [order_update_request](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-data-orders?meta=type%3Aorder_update_request)                             |
| OrganizationPreferences         | [organization_preferences](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-data-global-preferences?meta=type%3Aorganization_preferences)         |
| PathRecord                      | [path_record](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-data-catalogs?meta=type%3Apath_record)                                             |
| PaymentInstrumentUpdateRequest  | [payment_instrument_update_request](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-data-orders?meta=type%3Apayment_instrument_update_request)   |
| PaymentTransactionUpdateRequest | [payment_transaction_update_request](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-data-orders?meta=type%3Apayment_transaction_update_request) |
| Product                         | [product](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-data-products?meta=type%3Aproduct)                                                     |
| ProductInventoryRecord          | [product_inventory_record](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-data-inventory-lists?meta=type%3Aproduct_inventory_record)            |
| Promotion                       | [promotion](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-data-promotions?meta=type%3Apromotion)                                               |
| PromotionCampaignAssignment     | [promotion_campaign_assignment](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-data-promotions?meta=type%3Apromotion_campaign_assignment)       |
| RedemptionLimitPerPeriod        | [redemption_limit_per_period](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-data-coupons?meta=type%3Aredemption_limit_per_period)              |
| RedemptionLimits                | [redemption_limits](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-data-coupons?meta=type%3Aredemption_limits)                                  |
| ShippingAddressUpdateRequest    | [shipping_address_update_request](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-data-orders?meta=type%3Ashipping_address_update_request)       |
| SitePreferences                 | [site_preferences](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-data-site-preferences?meta=type%3Asite_preferences)                           |
| SlotConfiguration               | [slot_configuration](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-data-slot-configurations?meta=type%3Aslot_configuration)                    |
| SortingRule                     | [sorting_rule](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-data-sorting-rule-search?meta=type%3Asorting_rule)                                |
| SortingRuleStep                 | [sorting_rule_step](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-data-sorting-rule-search?meta=type%3Asorting_rule_step)                      |
| Store                           | [store](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/ocapi-data-stores?meta=type%3Astore)                                                           |
