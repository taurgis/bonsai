# Administrator Role in B2C Commerce

The administrator role is the top-level role for an organization. This role is automatically created and can't be deleted directly or indirectly by import. This topic applies to B2C Commerce.

The administrator role has the following properties:

*   Is always available in a new instance.
*   Cannot be deleted through B2C Commerce tools or the import.
*   Has access to all known system modules in all known sites (per organization).
*   Automatically gets access to all system modules of a newly created site.
*   Automatically gets access to new modules when deploying new releases (for all organizations and sites).
*   Can be extended with functional permissions.
*   Can be extended with access permissions for custom modules.
*   Can access permissions on all locales assigned to all roles. For locales created after Release 16.9, administrators must explicitly grant locale-specific permissions to a relevant role.

Administrator access for all system modules is ensured via the following mechanisms:

*   When a new site is created, the administrator role automatically receives the required access permissions for all site system modules. The administrator role maintains full access to all modules within all sites.
*   When the server starts, B2C Commerce checks whether the organizational and site level administrator roles still have access to all known system modules in all sites. The administrator role automatically gets access to newly introduced system modules (for example, when deploying new releases).

## Retrieving Passwords

We recommend that all customers and partners have one administrator who is responsible for the passwords of all their instances. This administrator is usually the default _admin_ user account included with every new instance. The admin user can create other named accounts that also have administrator permissions.

Developers use their own accounts to access instances and don't change or reset the global administrator password. After a dbinit is run on a sandbox, the administrator is responsible for changing the passwords for the sandbox back to the original passwords. See Using Dbinit.

Security settings let the administrator configure Business Manager passwords behaviors. An administrator can retrieve or reset a forgotten password using the _Forgot Password_ feature.

![Note](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-b2c_merchandiser_administrator-2-production-enus/__asset_version__/images/icon_note.png)

Note Salesforce Support resets only the main administrator password for the admin account. Only a user logged in as the admin user can reset other accounts with administrative access.

## Import and Export

The import logic rejects deletion attempts for the administrator role (for example, via DELETE mode import). The import logic also rejects any modification of system module access privileges (for example, via REPLACE mode import). The import log records both cases as warnings.

## Business Manager Module Permissions

Module permissions grant access to specific Business Manager modules. If a logged-in user has permission to access a Business Manager module, the application appears in the left navigation pane.

Grant read-only permission to certain modules and preferences. Users with read-only permission can view preferences and modules, but can't edit them. Read-only permission is available for the following modules: customers, products, product sets, global custom preferences, Content Assets, Customers, Inventory Lists, Job History, Libraries, Library Folders, Ordering, Price Books, Products, Product Sets, Site Preferences, and Variation Attributes. Enabling write access also enables read access.

You can also grant read-only permissions to Business Manager modules for all site-specific preferences. These preferences include locking, baskets, A/B tests, locales, currencies, source codes, gift certificates, guided search, sequence numbers, order, coupons, promotions, storefront toolkit, storefront URLs, system object definitions, and custom preferences.

If a Business Manager module provides site-specific functionality, permission is granted in context of that particular site or the entire organization. For example, orders are managed in the context of a site, so the permission on the Ordering module is granted in the context of the site.

## Business Manager Locale Permissions

Business Manager supports localization of business objects. Specify which users have access to a locale's data.

To give users access to a locale, first create a role using the Locale tab on the Roles and Permissions page. Assign the role to the user. Enabling write access also enables read access. Because every role requires read permission for at least the default locale, read permission is automatically assigned.

For example, a user with write permission can edit products within a locale. The user can edit localizable fields, such as description and name, and non-localizable fields, such as the brand and the merchandiser.

A user with read permission only on the selected locale can't edit any fields, even non-localizable fields.

## Business Manager Functional Permissions

Functional permissions aren't associated with a B2C Commerce tool module. They let a user perform specific functions in B2C Commerce.

For example: to make Alice an agent who can log in on behalf of any customer of site ABC, Alice needs the functional permission `_Login_On_Behalf_` for site ABC.

To edit data, these permissions must be combined with Business Manage module permissions.

### Organization-Wide Functional Permissions

The following table lists the functional permissions that apply to your organization as a whole:

| Permission | Description |
| --- | --- |
| Access_Customer_and_Customerlist_Impex | controls access to the Customers and Customer List in the Business Manager Import and Export module. Users have access to the import and export buttons and can import and export data. Limiting authorization provides better control over data import and export operations. It helps organizations maintain data integrity and follow security policies. Users can view relevant files and status overview on the Import and Export page. |
| Replication_Run_For_Org | Lets a user manage and start data replication processes for global replication tasks (that is, system object type definitions). |
| Manage_All_Catalogs | Lets a user:view, create, edit, organization catalogsassign catalogs to sitesview, create, edit, all assets in all catalogs in all languages and for all sitesAllows access to catalogs, categories, products, recommendations, variation attributes, options, product category assignments, or catalog images. Assign this permission to users who need access to Products, Catalogs, Product Options, Product Sets, Recommendations, or Variation Attributes modules. |
| Delete_All_Catalogs | Lets a user:delete organization catalogsdelete all assets in all catalogs in all languages and for all sitesHaving the Manage_Site_Catalog functional permission along with the Delete_All_Catalogs functional permission isn't sufficient to delete any catalog. Only users with both Manage_All_Catalogs and Delete_All_Catalogs can delete catalogs. As of Release 16.3, all users who previously had the _Manage\_All\_Catalogs_ permission are automatically assigned the additional Delete_All_Catalogs permission. |
| Manage_All_Libraries | Lets a user manage all libraries and their content assets for all sites. |
| Manage_All_PriceBooks | Lets a user:view, create, edit, delete organization price booksassign price books to sitesview, create, edit, delete prices in all price books for any productview, create, edit, delete product options and shared option prices (option prices aren't in price books)Allows access to price books, product prices, and option prices. Assign this permission to users who need access to Products, Product Options, or Price Books. |
| Manage_Inventory | Lets a user:view, create, edit, delete inventory listsassign inventory lists to sitesview, created, edit, delete inventory records in all inventory lists for any productAllows access to inventory lists and inventory records. Assign this permission to users who need access to the Products and Inventory modules. |
| Merge_Customers | Lets a user merge customers of one customer list into another customer list. |
| View_Coupon_Codes | Lets a user view full coupon codes in Business Manager, Open Commerce API (OCAPI), and through the export function. |

### Site-Wide Functional Permissions

The following table lists the available functional permissions to restrict a role to a specific site or sites.

| Permission | Description |
| --- | --- |
| Login_On_Behalf | Allows administrators to log into the Storefront on behalf of a customer, provided they also have Create_Order_On_Behalf_Of functional permission. For example, a call center application can access storefront data, but is restricted to the storefront. |
| Replication_Run_For_Site | Lets a user manage and start data replication processes for site-specific replication tasks (that is, search indexes). |
| Login_Agent | Lets an application log in as a customer in the storefront. Restricts the access to only those Business Manager users that have the permission Login_Agent. This permission lets an application, such as a call center application, access storefront data, but restrict it to specific sites. |
| Manage_Site_Catalog | For storefront catalog products, lets a user:view, create, edit, delete all non-localized attributesview localized attributes for all localesview, create, edit, delete localized attributes for allowed site localesFor products owned by another catalog, but assigned to the storefront catalog, lets a user:view non-localized attributesview localized attributes for all localesbrowse all other catalogs and assign products from other catalogs to the storefront catalog |
| Manage_Site_PriceBooks | Lets a user:view site price booksview, create, edit, delete prices in site price books for site productsUsers can't:edit any attributes of site price booksview non-site price booksSite prices books are either directly assigned to the site or assigned via source codes. Users with this permission can’t edit price books not assigned to site or source code.Allows access to price books, product prices, and option prices for the site. Assign this permission to users who need access to Products, Product Options, or Price Books. |
| Manage_Site_Inventory | Lets a user:view site inventory listview, create, edit, delete inventory records in site inventory list for site productsUsers can't:edit any attributes of site inventory listview non-site inventory listsAllows access to inventory lists and inventory records. Assign this permission to users who need access to the Products and Inventory modules. |
| Manage_Site_Library | Allows a user to edit an asset in a locale. The locale must be active for one of the sites that you have permissions. If the locale isn't enabled, you can't edit the content. |
| Adjust_Item_Price | Allows a user to add or delete a price adjustment at the item level. |
| Adjust_Shipping_Price | Allows a user to add or delete a price adjustment at the shipping level. |
| Adjust_Order_Price | Allows a user to add or delete a price adjustment at the order level. |
| Delete_Order_Note | Allows a user to delete a note at the order or basket level. |
| Delete_Order | Allows a user to delete all order information (including personal data in the order). |
| Create_Order_On_Behalf_Of | Allows administrators to log into the Storefront on behalf of a customer, and allows an agent to create orders via the Shop API. |
| Search_Orders | Allows a user to search for orders as an agent via the Shop API. |
| Handle_External_Orders | Allows a user to handle external orders as an agent via the Shop API. |
| Access_Protected_Storefront | Allows a user to access a password-protected storefront. |

## WebDAV Permissions

To grant access to specific WebDAV folders, use WebDAV permissions. WebDAV permissions apply to your entire organization.

| Permission | Description |
| --- | --- |
| /cartridges | Write access to the files in the /cartridges folder and its subfolders. |
| /catalogs/* | Read or write access to your organization's catalogs. You can grant access to all catalogs or selected catalogs. |
| /dynamic/* | Read or write access to your organization's dynamic folders. Grant access to all dynamic folders or selected dynamic folders. |
| /libraries/* | Read or write access to your organization's libraries. Grant access to all libraries or selected libraries. |
| /realmdata | Write access to the files in the /realmdata folder and its subfolders. |
| /securitylogs | Read access to the files in the /securitylogs folder and its subfolders. |
| (all other folders) | Read or write access to other top-level folders. |

### Permissions for Impex Folders

If you grant permission to a root folder with an asterisk, B2C Commerce grants full permission to all its subfolders, even if you haven't granted permission to a specific subfolder. For a subfolder with an asterisk, B2C Commerce also grants read and write permissions to all its subfolders unless you set permission for a subfolder to read only.

For example, the root folder `/impex/*` has an asterisk. You have access to `/impex/subfolder`, even if permission isn't granted.

For the subfolder `/impex/test/*`, select the read option to limit access to `/impex/test/subfolder` as read only.

## Assign a Price Adjustment Limit

Assign limits per user for manual price adjustments in Business Manager. You can select a context of one, multiple, or all sites for which the limits apply.

### Required Editions

| Available in: B2C Commerce |
| --- |

Access limits programmatically via the Script API, `dw.order.LineItemCtnr.verifyPriceAdjustmentLimits()`.

A price adjustment limits violation check is done during manual price adjustment creation by Open Commerce API (OCAPI), as follows:

```
POST /baskets/\{basket_id\}/price_adjustments
```

Price adjustment limits are imported and exported through the site import/export.

1.  Click App Launcher ![App Launcher](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-b2c_merchandiser_administrator-2-production-enus/__asset_version__/images/appLauncher.png), and then select **Administration** | **Organization** | **Roles and Permissions** > and select Administrator.
2.  On the **Price Adjustment Limits** tab, select the context in which you want to assign permissions.
3.  Click **Apply**.
4.  To add a limit, click **Add**.
5.  On the Add Price Adjustment Limit window, select a type (Item, Shipping, or Order), a currency, and a value.

    Price adjustment limits validation considers only the access roles with price adjustment [permissions](https://developer.salesforce.com/docs/commerce/b2c-commerce/guide/b2c-setting-permissions-for-csc.html) configured. Only price adjustment limits that are assigned to an access role with a specific type of price adjustment permission are considered when a manual price adjustment is validated. The type of price adjustment permission, item, order, or shipping, depends on the type of the manual price adjustment. To prevent all users with access to a role from creating unlimited manual item price adjustments, define price adjustment limits to access roles with an item, order, or shipping price adjustment permission.

6.  To change the context, click **Select Context**.

    When you change context from one to multiple sites, for example, you can see unassigned limits.

7.  To assign a limit, check the box next to the limit and click **Update**.
8.  To unassign a limit, clear the box next to the limit and click **Update**.
9.  To revert changes, click **Revert** before you click **Update**.

    When you click **Update**, your changes can't be reverted.

## Find All Users with a Particular Permission

Check which users have read or write access to a module.

### Required Editions

| Available in: B2C Commerce |
| --- |

1.  Click App Launcher ![App Launcher](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-b2c_merchandiser_administrator-2-production-enus/__asset_version__/images/appLauncher.png), and then select **Administration** | **Organization** | **Permission Audit**.
2.  Select a permission and, optionally, select an access level or site.
3.  Click **Find**.
4.  To sort or filter the user list, click **Export to CSV**.

    The CSV format provides sorting and filtering functionalities.
