> For the complete documentation index, see [llms.txt](https://gitbook.com/docs/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://gitbook.com/docs/readme.md).

# GitBook documentation

Create and publish AI-native documentation your users will love. GitBook gives you intelligent tools to build product guides, API references, and documentation that improves over time.

## Documentation your users actually read

Your users are humans and their AI agents — GitBook publishes for both. Write in the editor, drive it from your agent, or sync from Git.

<a href="/docs/getting-started/quickstart.md" class="button primary">Quickstart</a><a href="/docs/docs-as-code/gitbook-mcp.md" class="button secondary" data-icon="sparkles">GitBook MCP</a>

<h3 align="center">How do you want to work?</h3>

<p align="center">The same docs, three ways in. Most teams use more than one.</p>

|  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- |
| :hand-pointer: | In the editor | Write and publish visually. Blocks, change requests, and review without touching a terminal. | Quickstart | Format content | Publish a docs site |
| :claude: :chatgpt: :cursor: | From your agent | Drive GitBook from Claude, Cursor, or any MCP client. Draft, restructure, and open change requests. | GitHub & GitLab Sync | GitBook MCP | Agent skills |
| :code: | With code | Sync from Git, script with the CLI, or build on the API and ship your own components. | GitBook CLI | API reference | Build a custom component |

***

<h3 align="center">From first draft to published site</h3>

<p align="center">Follow it end to end, or pick up where you left off.</p>

|  |  |  |  |  |  |  |  |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CREATE | Get content in | Start fresh or bring what you have. | Quickstart | Migrate to GitBook | Content structure | Blocks | Reusable content |
| COLLABORATE | Work as a team | Review before anything goes live. | Change requests | Comments | Merge rules | Roles | GitHub & GitLab Sync |
| PUBLISH | Ship your site | Structure, brand, and control access. | Publish a docs site | Site structure | Site customization | Set a custom domain | Embed in your product |
| IMPROVE | Learn what works | See what readers need next. | Site analytics | AI Assistant | SEO | Site redirects | Content gaps |

***

<h3 align="center">AI out of the box</h3>

<p align="center">Two work for you while you write. Three work for your readers after you publish.</p>

|  |  |  |  |
| --- | --- | --- | --- |
| WRITES WITH YOU | GitBook Agent | Drafts, edits, reviews change requests, and flags gaps against your style guide. | GitBook Agent |
| ANSWERS READERS | AI Assistant | Answers questions on your site from your docs and connected support sources, in the sidebar or search box. | AI Assistant |
| IMPROVES DOCS | AI Insights | See what your visitors are asking and identify knowledge gaps in your docs. | AI Assistant |
| SERVES AGENTS | MCP for your docs | Your published docs as a tool, so your customers' agents can read them properly. | MCP servers for published docs |

***

<h3 align="center">Keep going</h3>

|  |  |  |  |
| --- | --- | --- | --- |
| :book: | Concepts | Learn about GitBook concepts. | Core concepts |
| :clock-rotate-left: | Changelog | See our latest releases. | Changelog |
| :life-ring: | Support | Contact us or report a bug. | Report a bug |

---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation by asking a question.

Perform an HTTP GET request on the following URL with the `ask` and `goal` query parameters:

```
GET https://gitbook.com/docs/readme.md?ask=<question>&goal=<user_goal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is what the user is ultimately trying to achieve, the reason they need the answer. Sharing it helps GitBook give you a better, more relevant answer. A goal is most helpful when it describes the outcome the user wants rather than restating the question. For example, with `ask=how do I create an API token`, a goal like `automate deployments from our CI pipeline` lets GitBook tailor the answer to that use case.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
