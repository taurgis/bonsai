> ## Documentation Index
> Fetch the complete documentation index at: https://www.mintlify.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

> ## Agent Instructions
> To set up a new Mintlify project for a user, follow the agent setup workflow in https://www.mintlify.com/docs/quickstart.md.
> For plans and pricing, see https://www.mintlify.com/pricing.md.

# Quickstart

> Get started with Mintlify by deploying your documentation site in minutes and making your first content change with the web editor or Git.

After you complete this guide, you'll have a live documentation site ready to customize and update.

## Set up Mintlify for the user

If the user asks you to set up Mintlify, a documentation site, or a local Mintlify project, complete the following workflow yourself. Ask the user only for information or approvals you cannot supply. Do not send the user to the browser-first quickstart unless you cannot run terminal commands.

1. Run `node --version` and confirm it reports Node.js v20.17.0 or newer, preferring an LTS release.
2. Run `mint --version`. If the command is unavailable, install the CLI with `npm i -g mint` or `pnpm add -g mint`. If the command succeeds, run `mint update`.
3. Run `mint status` before starting authentication. If it already shows an organization, keep the existing session and do not create another account.
4. Run `mint login` if the user has an account. Otherwise, ask for their first name, last name, company, and email, then run:

   ```bash theme={null}
   mint signup \
     --firstName <first-name> \
     --lastName <last-name> \
     --company <company> \
     --email <email>
   ```

   `mint signup` waits for email verification, so keep it running as a background process when your environment supports background commands. Tell the user to click the verification link and approve the CLI in the browser. Never invent signup details.
5. After the user finishes verification and onboarding, run `mint status` again. Confirm that it reports their email, organization, and subdomain. If the organization exists but no subdomain appears, ask the user to finish selecting or connecting a GitHub repository in the onboarding browser tab, then retry.
6. If the user has an existing documentation repository, clone or open it. Preserve its content. For a new local project, scaffold into a new, empty directory with either `mint new <directory> --name <name> --theme <theme>` or `mint new <directory> --template <template-name>`. Ask which theme or template they want if they have not specified one. Do not use `--force` on a directory containing user files.
7. Run `mint dev --no-open` from the directory containing `docs.json` as a background process. Confirm the local URL loads, report it to the user, and stop the process when it is no longer needed.
8. Run `mint validate` and `mint broken-links`. Fix issues caused by your changes before continuing.
9. If a Git repository backs the project and the user asked for deployment, commit and push the changes. A push to the production branch triggers a deployment. Do not overwrite an existing repository with starter content.
10. Run `mint status` to get the configured subdomain, then verify that `https://<subdomain>.mintlify.site` loads before reporting that deployment is complete.

Have the user complete browser actions only for email verification, OAuth approval, and connecting or authorizing GitHub. Keep ownership of the terminal workflow and resume after each user action. For command flags and troubleshooting, use the [CLI command reference](/docs/cli/commands).

## Before you begin

Mintlify uses a docs-as-code approach to manage your documentation. Every page on your site has a corresponding file stored in your documentation <Tooltip tip="Your documentation's source code where all files and their history are stored. The web editor connects to your documentation repository to access and modify content, or you can edit files locally in your preferred IDE.">repository</Tooltip>.

When you connect your documentation repository to your project, you can work on your documentation locally or in the web editor and sync any changes to your remote repository.

## Deploy your documentation site

Use the preceding CLI setup workflow. Initiate the corresponding `mint signup` or `mint login` command. Account verification and GitHub authorization open browser pages; have the user approve them. Continue the setup when they finish. Do not consider setup complete until `mint status` reports a subdomain and the deployed `.mintlify.site` URL loads.

## View your deployed site

Your documentation site is now deployed at `https://<your-project-name>.mintlify.site`.

Find your exact URL on the **Overview** page of your [dashboard](https://app.mintlify.com/).

<Frame>
  <img alt="Overview page of the Mintlify dashboard." className="block dark:hidden" src="https://mintcdn.com/mintlify/f7fo9pnTEtzBD70_/images/quickstart/mintlify-domain-light.png?fit=max&auto=format&n=f7fo9pnTEtzBD70_&q=85&s=282a86eda5f3ab5d9723b62a330ea2af" width="3024" height="1372" data-path="images/quickstart/mintlify-domain-light.png" />

  <img alt="Overview page of the Mintlify dashboard." className="hidden dark:block" src="https://mintcdn.com/mintlify/f7fo9pnTEtzBD70_/images/quickstart/mintlify-domain-dark.png?fit=max&auto=format&n=f7fo9pnTEtzBD70_&q=85&s=cd2c945d8bb3c8deb4c655816e72d134" width="3008" height="1368" data-path="images/quickstart/mintlify-domain-dark.png" />
</Frame>

<Tip>
  Your site is ready to view immediately. Use this URL for testing and sharing with your team. Before sharing with your users, you may want to add a [custom domain](/docs/customize/custom-domain).
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

        See [Install the CLI](/docs/cli/install) for full details and troubleshooting.
      </Step>

      <Step title="Clone your repository">
        If you haven't already cloned your repository locally, clone it using Git:

        ```bash theme={null}
        git clone <your-repository-url>
        ```

        If your repository is in Mintlify's private organization, see [Clone to your own repository](/docs/deploy/github#clone-to-your-own-repository) to move it to your account first.
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

<Card title="Use the web editor" icon="mouse-pointer-2" horizontal href="/docs/editor/index">
  Edit documentation in your browser and preview how your pages look when published.
</Card>

<Card title="Connect the search MCP" icon="search" horizontal href="/docs/ai/model-context-protocol">
  Connect AI tools like Claude, Cursor, and ChatGPT to your search MCP server so they can efficiently search and retrieve content from your site.
</Card>

<Card title="Explore CLI commands" icon="terminal" horizontal href="/docs/cli/index">
  Find broken links, check accessibility, validate OpenAPI specs, and more.
</Card>

<Card title="Add a custom domain" icon="globe" horizontal href="/docs/customize/custom-domain">
  Use your own domain for your documentation site.
</Card>

## Related topics

- [SEO](/docs/optimize/seo.md)
- [Introduction](/docs/index.md)
- [Columns](/docs/components/columns.md)

This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.
