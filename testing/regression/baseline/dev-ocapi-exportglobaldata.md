ExportGlobalDataConfiguration Document

Attention!

**The Open Commerce API (OCAPI) is now deprecated.** The provisions described in our [versioning and deprecation policy](https://developer.salesforce.com/docs/commerce/b2c-commerce/references/b2c-commerce-ocapi/versioninganddeprecationpolicy.html) fully apply. For all new projects and major refactoring work, use B2C Commerce API (SCAPI) as the default REST API. For additional details, refer to [Why Use SCAPI Instead of OCAPI](https://developer.salesforce.com/docs/commerce/commerce-api/guide/why-use-scapi.html).

# ExportGlobalDataConfiguration document

Copy as Markdown

View as Markdown

Copy URL to Markdown

Document representing a configuration for the global data units which should be exported.

| Property | Type | Constraints | Description |
| --- | --- | --- | --- |
| access_roles | Boolean |  | Access roles of the organization. |
| all | Boolean |  | Flag, if all Global Data should be exported. |
| csc_settings | Boolean |  | Settings for Customer Service Center customization. |
| csrf_whitelists | Boolean |  | CSRF Allowlists. Where possible, we changed noninclusive terms to align with our company value of Equality. Because changing terms in our code can break current implementations, we maintained this object name. |
| custom_preference_groups | Boolean |  | Custom Preference Groups (Meta Data). |
| custom_quota_settings | Boolean |  | Custom quota settings of the instance. |
| custom_types | Boolean |  | Custom Types (Meta Data). |
| geolocations | Boolean |  | Geolocations of the organization. |
| global_custom_objects | Boolean |  | Global custom objects. |
| job_schedules | Boolean |  | Scheduled job definitions. |
| job_schedules_deprecated | Boolean |  | Deprecated scheduled job definitions. |
| locales | Boolean |  | Locales. |
| meta_data | Boolean |  | System object type extensions and custom object type extensions. |
| oauth_providers | Boolean |  | OAuth providers. |
| ocapi_settings | Boolean |  | Global OCAPI settings. |
| page_meta_tags | Boolean |  | Page meta tag definitions. |
| preferences | Boolean |  | Global preferences. |
| price_adjustment_limits | Boolean |  | Price adjustment limits for all roles. |
| services | Boolean |  | Service definitions from the service framework. |
| sorting_rules | Boolean |  | Global sorting rules. |
| static_resources | Boolean |  | Global static resources. |
| system_type_definitions | Boolean |  | System Type Definitions (Meta Data). |
| users | Boolean |  | Users of the organization. |
| webdav_client_permissions | Boolean |  | Global WebDAV Client Permissions. |
