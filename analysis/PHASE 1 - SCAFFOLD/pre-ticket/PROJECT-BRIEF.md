# Project Brief

## One-Line Summary

Build a reusable optional `forward-nexus research` oclif plugin that turns source URLs into cached, source-cited, LLM-friendly Markdown so agents stop repeating manual web research and stop wasting context on raw HTML.

## Problem

The current research workflow exists as repository instructions and a specialized subagent. It asks agents to:

- prefer official documentation
- synthesize notes into `artifacts/online-research/`
- track source URLs and freshness metadata in frontmatter
- reuse fresh notes
- revalidate stale notes before re-fetching
- return provenance with answers

This works only when an agent reads and follows a long instruction set. It is hard to reuse across projects, hard to test, and easy to apply inconsistently. The CLI should move the same behavior into executable software.

## Goals

- Provide a stable command surface for agent research.
- Store research results locally in a transparent, inspectable format.
- Return compressed or detailed Markdown depending on the agent's context budget.
- Make cache hits fast and network-free.
- Make stale validation cheap when the source has not changed.
- Preserve provenance and freshness in every result.
- Fit the existing `forward-nexus` oclif architecture, JSON envelope, exit-code policy, and test style when loaded as an optional plugin.

## Non-Goals

- Do not build a general web crawler.
- Do not build a search engine.
- Do not silently run unbounded browser automation for every request.
- Do not introduce remote services or hosted storage.
- Do not store secrets, authenticated page bodies, or session-derived private data by default.
- Do not implement research as a core command in the main `forward-nexus` CLI.
- Do not change existing `forward-nexus` command contracts unless the ticket explicitly approves host integration work.
- Do not enable third-party plugin installation in the host without a separate plugin-host/security decision.

## Primary Users

- AI coding agents that need current official documentation before technical changes.
- Developers who want repeatable, inspectable research artifacts.
- Future `forward-nexus` plugins or commands that need a shared local research cache.

## User Stories

- As an agent, I can request `forward-nexus research <url> --json` after installing or linking the optional plugin and receive exactly one machine-readable JSON document.
- As an agent, I can ask for `--format compressed` when I need a short context payload.
- As an agent, I can ask for `--format detailed` when I need links, code samples, tables, or exact wording.
- As a developer, I can inspect the stored Markdown artifact and see source, freshness, and hash metadata in frontmatter.
- As a developer, I can run a dry validation command and see whether a cached item is fresh, stale, changed, or unavailable.

## Glossary

| Term | Meaning |
| --- | --- |
| Research artifact | Stored Markdown document plus frontmatter metadata for one normalized source. |
| Compressed representation | Token-minimized Markdown/text derived from the detailed extraction. |
| Detailed representation | Higher-fidelity Markdown preserving headings, links, code, tables, and useful structure. |
| Fresh | Cache entry can be served without network because its TTL/tier has not aged out. |
| Stale | Cache entry aged past freshness and should be revalidated before use. |
| Revalidation | Cheap source check using content hash, HTTP validators, or source re-fetch comparison. |
| Provenance | Source URL(s), timestamps, validation status, and enough metadata to judge reliability. |
| Tier | A named freshness policy such as `stable`, `standard`, or `volatile`. |

## Success Criteria

- A cached hit returns without network access.
- `--json` output is deterministic and follows the existing `forward-nexus` envelope.
- Human output never corrupts JSON stdout.
- Stale entries are not overwritten by transient network errors.
- Security tests cover invalid URLs, oversized responses, timeouts, redirects, and unsafe HTML.
- Contract tests cover help, flags, exit codes, JSON, and stdout/stderr behavior.
