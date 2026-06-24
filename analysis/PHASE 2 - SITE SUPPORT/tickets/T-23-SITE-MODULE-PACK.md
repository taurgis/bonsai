# T-23: Add Focused Modules for Remaining High-Value Custom Sites

## Goal

Add narrow site modules only after generic docs-engine, source, search, cleanup, rendered fallback, and chunking work is complete.

## Candidate Modules

- `angular`: if generated `docs-content` search/source mapping is custom and stable.
- `react`: if generic Next.js/source discovery cannot map React docs source or search config.
- `tailwind`: if Next.js App Router extraction still cannot recover exact examples and search metadata.
- `svelte`: if source/search mapping remains custom after generic SPA/source work.
- `mdn`: if compatibility/source mapping needs platform-specific handling.

## Scope

- Each module must declare why generic capabilities are insufficient.
- Each module must include fixtures for:
  - one successful article extraction.
  - one search result if search is implemented.
  - one source mapping if source is implemented.
  - one known failure mode from the Phase 2 analysis.
- Keep custom code behind the existing `SiteModule` shape or its Phase 2 extension.

## Out of Scope

- Adding modules for sites already covered well by generic engines.
- Building broad crawlers.

## Acceptance Criteria

- No custom module is added without fixture evidence.
- Modules do not duplicate generic VitePress/Docusaurus/Starlight/Next functionality.
- Site module IDs are stable and stored in artifact metadata.
- Existing Salesforce modules continue to work.

## Validation

```bash
pnpm test -- --run src/sites
pnpm type-check
```

