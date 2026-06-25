---
description: 'Research Salesforce Help and Developer docs through Bonsai site modules before Salesforce-related changes — search Help live with --domain, and let the site modules render and extract the JavaScript-only pages.'
applyTo: '**'
skills:
  - web-research
metadata:
  version: '1.0.0'
---

# Salesforce Documentation Research Requirement

This is the `web-research` requirement specialized for Salesforce. Everything in that rule still applies; this adds how to research Salesforce Help and Developer docs, which need Bonsai's site modules to capture correctly.

## Mandatory Pre-Step

- Before creating, updating, refactoring, or scaffolding anything that depends on Salesforce platform behavior (Apex, SOQL, Flows, permissions, setup, REST/Metadata APIs, Lightning), verify the relevant current Salesforce documentation **in the same task** through Bonsai.
- Cite the official Salesforce source URL when the change relies on documented platform behavior.
- Training-data knowledge never satisfies this — Salesforce ships changes every release, so only docs fetched in the current task count.

## Why Salesforce Needs Site Modules

Both `help.salesforce.com` and `developer.salesforce.com` are Lightning Web Runtime (LWR) pages: the article text is rendered by JavaScript, so a plain fetch returns an almost-empty shell. Bonsai ships per-domain **site modules** that force browser rendering and run Salesforce-specific extraction, so a normal Bonsai fetch already returns clean Markdown for these hosts — you do not need to add `--rendered` yourself.

## Choose How to Research by Scope

- **Minor research — run it inline.** For one known Salesforce page or a quick lookup, the main agent invokes the **web-research** skill directly.
- **Extensive research — delegate to a subagent.** For multiple Salesforce topics, cross-referencing Help against Developer docs, or broad audits, delegate to the **Salesforce Docs Researcher** subagent and apply its findings.

## Salesforce Site Modules

- **Salesforce Help (`help.salesforce.com`)** — custom rendered fetch **and** live search. Search the site's Coveo backend directly instead of the local cache:

  ```bash
  npx @taurgis/bonsai search "single sign-on" --domain help.salesforce.com
  ```

- **Salesforce Developer (`developer.salesforce.com`)** — custom rendered fetch only. There is **no** `--domain` search for this host, so `--domain developer.salesforce.com` exits with an error; discover Developer URLs another way, then fetch them through Bonsai.
- **Exact hostname only.** `help.salesforce.com` is matched; subdomains are not. Fetch the canonical `/s/articleView?id=…` URLs (Bonsai normalizes legacy `/help_doccontent?id=…` links to them automatically).

## When Not to Use

- The change does not touch Salesforce platform behavior (use the generic `web-research` requirement).
- You already fetched and applied the relevant Salesforce docs **in the current task**.
- The request is a trivial typo or formatting fix unrelated to platform behavior.
