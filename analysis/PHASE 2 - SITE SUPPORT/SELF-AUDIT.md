# Self-Audit: Phase 2 Site Support Pack

## Audit Date

2026-06-24

## What Was Checked

- Local file inventory under `analysis/PHASE 2 - SITE SUPPORT`.
- Link and ticket structure against the Phase 1 ticket style.
- Existing research cache entries created by the compiled CLI.
- Existing graph output for repository validation and research conventions.
- Claims that used uncertain words such as "likely", "not confirmed", and "available".

## Findings and Fixes

### 1. Some Source/Search Claims Were Too Confident

The first draft mixed verified observations with reasonable inferences. That is risky for implementation tickets because an agent may treat "likely public search API" as already proven.

Fix:

- Added evidence levels to the site matrix.
- Reworded unverified search/source entries as "needs verification" or "observed signal only".
- Added ticket acceptance criteria requiring saved HTML/source fixtures before implementation.

### 2. Search Support Needs a Discovery Contract Before Connectors

The first draft correctly identified search as important, but it under-specified the difference between:

- A visible search UI.
- A public search config in HTML.
- A fetchable public search index.
- A stable API contract safe for automated callers.

Fix:

- Added a search evidence classification to [SITE-MATRIX.md](SITE-MATRIX.md).
- Tightened [T-20](tickets/T-20-REMOTE-DOCS-SEARCH.md) so connector work must prove endpoint/index availability from fixtures.

### 3. Source Markdown Mapping Needs Proof Per Site

Several sites have public repositories, but a public repo is not the same as a deterministic URL-to-source mapping.

Fix:

- Reworded public-repo-only sites as "source likely, mapping unverified".
- Tightened [T-19](tickets/T-19-SOURCE-MARKDOWN-MAPPING.md) to require raw-source URL validation and fallback behavior.

### 4. Ticket Pack Needed a Stronger Fixture Policy

The original tickets had validation commands but did not require preserving the exact observed failure pages as fixtures.

Fix:

- Added a fixture policy to [tickets/README.md](tickets/README.md).
- Added fixture/source requirements to T-16, T-17, T-18, T-19, T-20, T-21, and T-22.

### 5. Selection Rationale Is Good Enough for Scope, Not a Popularity Ranking

The selected sites are representative, not a mathematically complete top-N list. That distinction matters because the work is parser-shape driven.

Fix:

- Kept the Stack Overflow 2025 usage rationale.
- Clarified that parser support is driven by usage plus extraction shape.

## Remaining Risks

- Several search backends still need concrete endpoint verification: React, Next.js, Tailwind, Prisma, Svelte, NestJS, TanStack Query, Express, TypeScript, Angular.
- MDN and Node source mapping should be verified against raw GitHub URLs before implementation.
- Docusaurus detection should be proven with Redux Toolkit route/sidebar fixtures before generalizing.
- Next.js App Router RSC extraction is still a hypothesis for Tailwind and should not be implemented without fixtures.
- The graph output predates the new Phase 2 files, so it was useful only for repository convention context, not for validating the new docs content.

## Useful Audit Commands

```bash
find 'analysis/PHASE 2 - SITE SUPPORT' -type f | sort
LC_ALL=C rg -n "[^[:ascii:]]" 'analysis/PHASE 2 - SITE SUPPORT'
rg -n "likely|not confirmed|not obvious|available|public API" 'analysis/PHASE 2 - SITE SUPPORT'
node bin/cli.mjs research search "Phase 2 site support docs engine source markdown search" --json
```

