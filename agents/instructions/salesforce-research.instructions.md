---
description: 'Verify current official docs before technical repo changes — inline via the web-research skill for minor research, via the Salesforce Docs Researcher subagent for extensive research. Specialized for Salesforce Help and Developer docs.'
applyTo: '**'
skills:
  - web-research
metadata:
  version: '1.0.2'
---

# Web Research Requirement (Salesforce)

## Mandatory Pre-Step

- Verify the relevant current official documentation **in the same task** before creating, updating, refactoring, scaffolding, or deleting technical content.
- Apply what you find — cite official source URLs when the change relies on platform behavior or standards.
- Research is the requirement; how you run it scales with scope (below). Training-data knowledge never satisfies this — only docs fetched in the current task do.

## Choose How to Research by Scope

- **Minor research — run it inline.** For a single known page, one platform, or a quick flag/API/version check, the main agent invokes the **web-research** skill directly. A separate subagent is not required.
- **Extensive research — delegate to a subagent.** For multiple sources or platforms, unfamiliar territory, broad audits, or anything that produces verbose output you do not want in the main context, run the **Salesforce Docs Researcher** subagent and apply its findings.
- The main agent may always use the **web-research** skill directly — choose the subagent to isolate large research, not because inline research is disallowed.
- When unsure, start inline and escalate to the subagent once the work spans several sources.

## Shared Cache

- **Local Cache Search (Default)**: Always search the local cache first using `bonsai search "<query>"`. This checks everything you've researched across all domains, even ones that don't support online search APIs.
- **Online URL Discovery (Fallback)**: If the local cache comes up empty, use `--domain <domain>` or `--remote <docs-url>` to quickly hit a site's search API and find the official URLs you need to fetch. This is specifically for online URL discovery when local cache fails.
- If Bonsai is configured for project storage and `.bonsai/research/` is not ignored by git, treat those cache artifacts as intentional shared project files. It is OK to check them in, and agents must not delete them as incidental generated output without an explicit request.
- Re-running on a recent topic is cheap — research the topic rather than skipping it to "save" a fetch.
- Supported remote API domains: `help.salesforce.com`, `react.dev`, `vuejs.org`, `tailwindcss.com`, `nextjs.org`, `jestjs.io`, `cypress.io`, `vitest.dev`, `vitepress.dev`, `angular.dev`, `redux.js.org`, `vitejs.dev`, `fastify.dev`, `rollupjs.org`, `vueuse.org`.

## Working with Salesforce Sites

Salesforce Help and Developer docs are JavaScript-rendered (LWR), so Bonsai uses per-host **site modules** that render and extract them for you — a normal Bonsai fetch returns clean Markdown for these hosts without `--rendered`.

- **Search Help live** when you do not have a URL yet — this hits Salesforce's own backend, not the local cache:

  ```bash
  npx @taurgis/bonsai search "single sign-on" --domain help.salesforce.com
  ```

- `developer.salesforce.com` has a rendered fetch but **no** `--domain` search (passing it errors); find Developer URLs another way, then fetch them through Bonsai.
- Matching is by exact hostname; prefer canonical `/s/articleView?id=…` Help URLs (Bonsai normalizes legacy `/help_doccontent?id=…` links automatically).

## When Not to Use

- No technical content is being modified (purely editorial changes).
- You already fetched and applied official docs **in the current task**. Training-data knowledge does not satisfy this — only docs fetched in the same task do.
- The request is too simple to warrant research (typo, lint fix not involving platform behavior).

## Examples

- ✅ Confirming one platform's current flag or frontmatter field before a small edit → run the web-research skill inline.
- ✅ Finding a Salesforce Help article by topic → `npx @taurgis/bonsai search "<topic>" --domain help.salesforce.com`, then fetch the chosen URL through Bonsai.
- ✅ Comparing conventions across several platforms, or auditing/refactoring source broadly → delegate to the Salesforce Docs Researcher subagent.
- ✅ Before editing instructions, prompts, agents, skills, workflows, or docs — reading source code does not replace checking current platform guidance.
- ✅ Include official source URLs when the change references platform behavior or standards.
- ❌ Don't modify technical content without researching first, and don't treat cached or training knowledge as equivalent — official guidance evolves and must be verified per task.
