# Create a Guided Shopping Agent for a B2B Store

Create a Guided Shopping Agent to unlock agent capabilities in your store. Guided Shopping Agent includes standard subagents, which are preconfigured categories of actions that help the agent recognize how to behave and respond for different jobs.

### Required Editions

| View supported editions. |
| --- |

![Note](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-commerce-comm-264-0-0-production-enus/__asset_version__/images/icon_note.png)

Note The Commerce Product Details subagent doesn't support custom branding.

The Commerce Cart Management subagent supports only simple products.

Qualification rules and localization on Lightning web components aren't supported by the agent.

1.  In the App Launcher, search for and select **Agentforce Studio**.
2.  To create an agent, click **New Agent**.
3.  Select the Agentforce for **Agentforce for Guided Shopping - B2B** template, and then click **Next**.

    ![Screenshot showing the Agentforce for Guided Shopping - B2B template](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-commerce-comm-264-0-0-production-enus/__asset_version__/comm/images/b2b_newshopperagenttemplate.png)

4.  Specify a name and developer name for your B2B guided shopping agent.
5.  Select a user and click **Let's Go**.

    Your agent is created with subagents already included. Salesforce recommends keeping all the default subagents. Use the standard subagents as a starting point for common use cases. After creating your agent, you can customize or create custom subagents in Agentforce Studio.

6.  (Optional). Add a subagent to a pre-existing agent.
    1.  In the App Launcher, search for and select **Agentforce Studio**.

        The agent opens in Agentforce Builder.

    2.  If the agent is active, create a new version.
    3.  Click ![Screenshot showing the New Agent button](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-commerce-comm-264-0-0-production-enus/__asset_version__/comm/images/comm_agent_agentbuilder_add.png) and select **Add to Agent**.
7.  Configure Messaging Settings.
    1.  In the Quick Find box, enter and select **Messaging Settings**.
    2.  Enable**Messaging**.
    3.  Click **New Channel**
    4.  Specify the type of channel to create. For example, select Enhanced Chat.
    5.  Specify the Channel Name and Domain, and click **Next**.
    6.  Specify the Agentforce Service Agent and the queue, and save your changes.
    7.  To enable the agent to interact with buyers in their selected locale, enable **Identify preferred language of users**.
8.  (Optional) To enable enhanced agent interactions, switch your embedded service deployment to V2.
    1.  In the messaging channel you created, under Embedded Service Deployments, click the embedded service deployment associated with the messaging channel.
    2.  On the Embedded Service Deployment Settings page, click **Switch to V2**.
    3.  Click **Switch and Publish**.
    4.  Publish your embedded service.
9.  In Agentforce Builder, select the **Commerce Customer Verification** subagent.
10.  Under Reasoning Instructions, locate the instruction, `Always use the hardcoded value 'webStoreIdValue' for the input webStoreId parameter in any action requiring this identifier.`. Change `webStoreIdValue` to your store's webstore ID.

     The webstore ID is a 15-character record ID beginning with OZE. You can find the webstore ID in your store URL.

11.  Save your work.
12.  In Agentforce Builder, select the **Commerce Order** subagent.
13.  Under Reasoning Instructions, locate the instruction `For the Cart URL, use the cart ID from the response of Add Order to Cart as the cartId to create a URL. Present the URL as text and not a link. The URL should be like this :loginPageUrl}?startURL={cartPageUrl}/cart`. Change the webStoreIdValue value to your store's webstore ID. Replace `{loginPageUrl}?startURL={cartPageUrl}/cart` with webStoreUrl/cart, where `webStoreUrl` is your store’s URL. For example, https://mydomain.com/store/cart.
14.  Locate the instruction `For the Order Url, use the orderSummary.id retrieved from Look Up Order Summary as orderId to create a URL. The URL should be presented as text and not a link. The URL should be like this {loginPageUrl}?startURL={orderSummaryPageUrl}/orderId.`. Replace `{loginPageUrl}?startURL={orderSummaryPageUrl}/orderId` with webStoreUrl/orderSummary/{orderId}, where webStoreUrl is your store's URL. For example, https://mydomain.com/store/orderSummary/{orderId}.
15.  Save your work.
16.  Add your domain URL as a trusted site.

     See [Add a Content Security Policy (CSP) Trust Site for the Commerce Einstein Domain](https://help.salesforce.com/s/articleView?id=commerce.comm_einstein_csp_trusted_site_add.htm&language=en_US&type=5).

#### See Also

*   [Customize Your Agents with Topics and Actions](https://help.salesforce.com/s/articleView?id=ai.copilot_topics_actions.htm&language=en_US&type=5)
*   [Explore Standard Agent Topics and Actions](https://help.salesforce.com/s/articleView?id=ai.copilot_ref.htm&language=en_US&type=5)
*   [Add a Topic from the Asset Library](https://help.salesforce.com/s/articleView?id=ai.copilot_topics_add_standard.htm&language=en_US&type=5)
*   [Agentforce Commerce Agent Topics](https://help.salesforce.com/s/articleView?id=ai.copilot_topics_ref_agentforce_commerce_agents.htm&language=en_US&type=5)
*   [Agentforce Commerce Agent Actions](https://help.salesforce.com/s/articleView?id=ai.copilot_actions_ref_commerce_parent.htm&language=en_US&type=5)
