> ## Documentation Index
> Fetch the complete documentation index at: https://www.mintlify.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Quickstart

> Get started with Mintlify by deploying your documentation site in minutes and making your first content change with the web editor or Git.

After you complete this guide, you'll have a live documentation site ready to customize and update.

## Before you begin

Mintlify uses a docs-as-code approach to manage your documentation. Every page on your site has a corresponding file stored in your documentation <Tooltip tip="Your documentation's source code where all files and their history are stored. The web editor connects to your documentation repository to access and modify content, or you can edit files locally in your preferred IDE.">repository</Tooltip>.

When you connect your documentation repository to your project, you can work on your documentation locally or in the web editor and sync any changes to your remote repository.

<Tip>
  Using an AI coding tool?

  Copy the following prompt to add the Mintlify [skill](/ai/skillmd) and [MCP server](/ai/model-context-protocol) for better results when updating your documentation.
</Tip>

<Prompt description="Install the Mintlify skill and MCP servers for AI coding tools." actions={["copy", "cursor"]}>
  Install the Mintlify skill for context on project structure, components, and documentation best practices:

  npx skills add [https://mintlify.com/docs](https://mintlify.com/docs)

  Add the Mintlify Docs MCP server for documentation search:

  [https://mintlify.com/docs/mcp](https://mintlify.com/docs/mcp)

  Add the Mintlify MCP server for dashboard access and content management:

  [https://mcp.mintlify.com](https://mcp.mintlify.com)
</Prompt>

## Deploy your documentation site

Go to [mintlify.com/start](https://mintlify.com/start) and complete the onboarding process. During onboarding, you'll connect your GitHub account, create or select a repository for your documentation, and install the GitHub App to enable automatic deployments.

After onboarding, your documentation site deploys and is accessible at your `.mintlify.site` URL.

<AccordionGroup>
  <Accordion title="Optional: Skip connecting a Git provider during onboarding">
    If you want to get started quickly without connecting your own repository, you can skip the Git provider connection during onboarding. Mintlify creates a private repository in a private organization and automatically configures the GitHub App for you.

    This lets you use the web editor immediately. If you want to use your own repository later, go to [Git Settings](https://app.mintlify.com/settings/deployment/git-settings) in your dashboard to migrate your content using the Git setup wizard. See [Clone to your own repository](/deploy/github#clone-to-your-own-repository) for details.
  </Accordion>
</AccordionGroup>

## View your deployed site

Your documentation site is now deployed at `https://<your-project-name>.mintlify.site`.

Find your exact URL on the **Overview** page of your [dashboard](https://app.mintlify.com/).

<Frame>
  <img alt="Overview page of the Mintlify dashboard." className="block dark:hidden" src="https://mintcdn.com/mintlify/f7fo9pnTEtzBD70_/images/quickstart/mintlify-domain-light.png?fit=max&auto=format&n=f7fo9pnTEtzBD70_&q=85&s=282a86eda5f3ab5d9723b62a330ea2af" width="3024" height="1372" data-path="images/quickstart/mintlify-domain-light.png" />

  <img alt="Overview page of the Mintlify dashboard." className="hidden dark:block" src="https://mintcdn.com/mintlify/f7fo9pnTEtzBD70_/images/quickstart/mintlify-domain-dark.png?fit=max&auto=format&n=f7fo9pnTEtzBD70_&q=85&s=cd2c945d8bb3c8deb4c655816e72d134" width="3008" height="1368" data-path="images/quickstart/mintlify-domain-dark.png" />
</Frame>

<Tip>
  Your site is ready to view immediately. Use this URL for testing and sharing with your team. Before sharing with your users, you may want to add a [custom domain](/customize/custom-domain).
</Tip>

## Make your first change

<Tabs>
  <Tab title="CLI">
    <Steps>
      <Step title="Install the CLI">
        The CLI requires [Node.js](https://nodejs.org/en) v20.17.0 or higher. Use an LTS version for stability.

        <CodeGroup>
          ```bash npm theme={null}
          npm i -g mint
          ```

          ```bash pnpm theme={null}
          pnpm add -g mint
          ```
        </CodeGroup>

        See [Install the CLI](/cli/install) for full details and troubleshooting.
      </Step>

      <Step title="Clone your repository">
        If you haven't already cloned your repository locally, clone it using Git:

        ```bash theme={null}
        git clone <your-repository-url>
        ```

        If your repository is in Mintlify's private organization, see [Clone to your own repository](/deploy/github#clone-to-your-own-repository) to move it to your account first.
      </Step>

      <Step title="Edit a page">
        Open `index.mdx` in your preferred editor and update the description in the frontmatter:

        ```mdx theme={null}
        ---
        title: "Introduction"
        description: "Your custom description here"
        ---
        ```
      </Step>

      <Step title="Preview locally">
        Run the following command from your documentation directory:

        ```bash theme={null}
        mint dev
        ```

        View your preview at `http://localhost:3000`.
      </Step>

      <Step title="Push your changes">
        Commit and push your changes to trigger a deployment:

        ```bash theme={null}
        git add .
        git commit -m "Update description"
        git push
        ```

        Mintlify automatically deploys your changes. View your deployment status on the [Overview](https://app.mintlify.com/) page of your dashboard.
      </Step>
    </Steps>
  </Tab>

  <Tab title="Web editor">
    <Steps>
      <Step title="Open the web editor">
        Navigate to the [web editor](https://app.mintlify.com/editor) in your dashboard.
      </Step>

      <Step title="Edit a page">
        Open the **Introduction** page and update the description.

        <Frame>
          <img alt="Introduction page open in the web editor with the description edited to say Hello world!." className="block dark:hidden" src="https://mintcdn.com/mintlify/_QFFqIcd0kEHBWdV/images/quickstart/hello-world-light.png?fit=max&auto=format&n=_QFFqIcd0kEHBWdV&q=85&s=200e0b5ba8522cced5de0d27abc86188" width="1622" height="402" data-path="images/quickstart/hello-world-light.png" />

          <img alt="Introduction page open in the web editor with the description edited to say Hello world!." className="hidden dark:block" src="https://mintcdn.com/mintlify/_QFFqIcd0kEHBWdV/images/quickstart/hello-world-dark.png?fit=max&auto=format&n=_QFFqIcd0kEHBWdV&q=85&s=dad2b658950fdd6ec93e815a06db7211" width="1624" height="404" data-path="images/quickstart/hello-world-dark.png" />
        </Frame>
      </Step>

      <Step title="Publish">
        Click **Publish** in the top-right of the web editor toolbar.
      </Step>

      <Step title="View live">
        On the [Overview](https://app.mintlify.com/) page of your dashboard, you can see your site's deployment status. When it finishes deploying, refresh your documentation site to see your changes live.
      </Step>
    </Steps>
  </Tab>
</Tabs>

## Next steps

<Card title="Use the web editor" icon="mouse-pointer-2" horizontal href="/editor/index">
  Edit documentation in your browser and preview how your pages look when published.
</Card>

<Card title="Explore CLI commands" icon="terminal" horizontal href="/cli/index">
  Find broken links, check accessibility, validate OpenAPI specs, and more.
</Card>

<Card title="Add a custom domain" icon="globe" horizontal href="/customize/custom-domain">
  Use your own domain for your documentation site.
</Card>

## Related topics

- [Ask agent](/docs/editor/agent.md)
- [What is Mintlify?](/docs/what-is-mintlify.md)
- [Create developer documentation](/docs/guides/developer-documentation.md)
