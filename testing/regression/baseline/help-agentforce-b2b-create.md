# Create a Guided Shopping Agent for a B2B Store

Create a Guided Shopping Agent to unlock agent capabilities in your store. Guided Shopping Agent includes standard subagents, which are preconfigured categories of actions that help the agent recognize how to behave and respond for different jobs.

### Required Editions

| View supported editions. |
| --- |

![Note](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-commerce-comm-262-0-0-production-enus/__asset_version__/images/icon_note.png)

Note The Commerce Product Details subagent doesn't support custom branding.

The Commerce Cart Management subagent supports only simple products.

Qualification rules and localization on Lightning web components aren't supported by the agent.

1.  In your Salesforce org, click [](https://help.salesforce.com/s?language=en_US)![Setup](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-commerce-comm-262-0-0-production-enus/__asset_version__/comm/images/comm_setup_icon_no_border.png) at the top of the page, and then select **Setup**.
2.  In the Quick Find box, enter Agentforce Agents, and select **Agentforce Agents**.
3.  To create an agent, click **New Agent**.
4.  Select the Agentforce for **Guided Shopping - B2B template**, and then click **Next**.

    [](https://help.salesforce.com/s?language=en_US)![Select an agent window with Agentforce for Guided Shopping - B2B template selected.](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-commerce-comm-262-0-0-production-enus/__asset_version__/comm/images/comm_agent_template.jpg)

5.  On the Review Topics page, review the subagents included in the template. Salesforce suggests keeping all default subagents.

    The Agentforce for Guided Shopping - B2B template includes standard subagents (Commerce User Verification, Commerce Order, Commerce Effective Accounts, Commerce Global Instructions, Commerce Product Search Assistant, Commerce Cart Management, and Commerce Product Details). You can use the standard subagents as a starting point for common use cases.

    After creating your agent, you can customize or create custom subagents in Agent Builder.

6.  Click **Next**.
7.  Enter the details for your agent.

    | Name | Guided Shopping Agent |
    | --- | --- |
    | API Name | Guided_Shopping_Agent |
    | Description | Enter a description for the agent.For example, Deliver personalized customer interactions with an autonomous AI agent. Agentforce Guided Shopping Agent intelligently supports your customers with common inquiries related to product and order. |
    | Role | Enter a job description for the agent. |
    | Company | Enter a description for the company that the agent represents. |
    | Agent User | Select a user or create one specifically for your agent.Assign the user a permission set that contains the Agent User license. For example, if you’re creating a Service Agent, you can assign the user to the Agentforce Service Agent User permission set. |

8.  Click **Keep a record of conversations with Enhanced Event Logs to review agent behavior** so you can review and troubleshoot agent sessions. See [Enable Enhanced Event Logs](https://help.salesforce.com/s/articleView?id=ai.copilot_setup_enhanced_event_logs.htm&language=en_US&type=5).
9.  Click **Next**.
10.  Click **Create**.

     [](https://help.salesforce.com/s?language=en_US)![Customize your agent window with information for Guided Shopping Agent entered](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-commerce-comm-262-0-0-production-enus/__asset_version__/comm/images/comm_agent_customize_agent.jpg)

11.  (Optional). To add Guided Shopping subagents to a pre-existing agent, select the agent and then click **Open in Builder**. If the agent is active, click **Deactivate**. Click **New** | **Add From Asset Library**. Select the subagents to add, and then click **Finish**.

     The B2B subagents are Commerce User Verification, Commerce Order, Commerce Effective Accounts, Commerce Global Instructions, Commerce Product Search Assistant, Commerce Cart Management, and Commerce Product Details.

12.  Configure Messaging Settings.
     1.  In the Quick Find box, enter and select **Messaging Settings**.
     2.  Enable**Messaging**.
     3.  Click **New Channel**
     4.  Specify the type of channel to create. For example, select Enhanced Chat.
     5.  Specify the Channel Name and Domain, and click **Next**.
     6.  Specify the Agentforce Service Agent and the queue, and save your changes.
     7.  To enable the agent to interact with buyers in their selected locale, enable **Identify preferred language of users**.
13.  (Optional) To enable enhanced agent interactions introduced in Summer '26, switch your embedded service deployment to V2.
     1.  In the messaging channel you created, under Embedded Service Deployments, click the embedded service deployment associated with the messaging channel.
     2.  On the Embedded Service Deployment Settings page, click **Switch to V2**.
     3.  Click **Switch and Publish**.
     4.  Publish your embedded service.
14.  In Agent Builder, select the **Commerce Global Instructions** subagent.
15.  Click **New Version**.
16.  Locate the instruction that begins with Always use the hardcoded value. Change the webStoreIdValue value to your store's webstore ID.

     This ID is a 15-character record ID beginning with OZE. Always use the hard coded value '0ZExxxxxxxxxxxx' for the input webStoreId parameter in any action that requires this identifier.

     [](https://help.salesforce.com/s?language=en_US)![Commerce Global Instructions subagent instruction with replaced webstore ID value](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-commerce-comm-262-0-0-production-enus/__asset_version__/comm/images/comm_agent_global_instructions_replace_value.jpg)

     ![Note](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-commerce-comm-262-0-0-production-enus/__asset_version__/images/icon_note.png)

     [](https://help.salesforce.com/s?language=en_US)Note Locate the webStoreUrl on the store's setup page in the URL. [](https://help.salesforce.com/s?language=en_US)![Location within store setup to find the store's webstore ID.](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-commerce-comm-262-0-0-production-enus/__asset_version__/comm/images/comm_agent_webstore_id_location.jpg)

17.  Save your work.
18.  In Agent Builder, select the **Commerce Order** subagent.
19.  Click **New Version**.
20.  Locate the instruction that begins with For the cart URL. Replace {loginPageUrl}?startURL={cartPageUrl}/cart with webStoreUrl/cart, where webStoreUrl is your store's URL. For example, https://mydomain.com/store/cart.

     [](https://help.salesforce.com/s?language=en_US)![Commerce Order cart URL subagent instruction replaced text with example webstore ID](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-commerce-comm-262-0-0-production-enus/__asset_version__/comm/images/comm_agent_cart_url_replace.jpg)

21.  Locate the instruction that begins with For the Order Url. Replace {loginPageUrl}?startURL={orderSummaryPageUrl}/orderId with webStoreUrl/orderSummary/{orderId}, where webStoreUrl is your store's URL. For example, https://mydomain.com/store/orderSummary/{orderId}.

     [](https://help.salesforce.com/s?language=en_US)![Commerce Order order URL subagent instruction replaced fields with webstore ID.](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-commerce-comm-262-0-0-production-enus/__asset_version__/comm/images/comm_agent_replace_commerce_order_instruction_order_url.jpg)

22.  Save your work.
23.  Add your domain URL as a trusted site.

     See [Add a Content Security Policy (CSP) Trust Site for the Commerce Einstein Domain](https://help.salesforce.com/s/articleView?id=commerce.comm_einstein_csp_trusted_site_add.htm&language=en_US&type=5).

![Example](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-commerce-comm-262-0-0-production-enus/__asset_version__/images/icon_example.png)

Example A Guided Shopping agent with all the B2B Commerce subagents added.

[](https://help.salesforce.com/s?language=en_US)![A B2B store with all Commerce subagents added.](https://sf-zdocs-cdn-prod.zoominsoftware.com/tdta-commerce-comm-262-0-0-production-enus/__asset_version__/comm/images/comm_b2bagent_subagents.png)

#### See Also

*   [Customize Your Agents with Topics and Actions](https://help.salesforce.com/s/articleView?id=ai.copilot_topics_actions.htm&language=en_US&type=5)
*   [Explore Standard Agent Topics and Actions](https://help.salesforce.com/s/articleView?id=ai.copilot_ref.htm&language=en_US&type=5)
*   [Add a Topic from the Asset Library](https://help.salesforce.com/s/articleView?id=ai.copilot_topics_add_standard.htm&language=en_US&type=5)
*   [Agentforce Commerce Agent Topics](https://help.salesforce.com/s/articleView?id=ai.copilot_topics_ref_agentforce_commerce_agents.htm&language=en_US&type=5)
*   [Agentforce Commerce Agent Actions](https://help.salesforce.com/s/articleView?id=ai.copilot_actions_ref_commerce_parent.htm&language=en_US&type=5)
