# T-16: Detect Docs Engines and Expose Site Capabilities

## Goal

Detect common documentation engines and expose their capabilities through the research pipeline so most sites do not require custom parsers.

## Evidence

- Vue and Vite expose VitePress globals: `window.__VP_HASH_MAP__` and `window.__VP_SITE_DATA__`.
- Astro exposes Astro/Starlight generator metadata, `data-pagefind-body`, `data-pagefind-ignore`, and `sl-doc-search`.
- Redux Toolkit has a Docusaurus-style docs shape.
- React, Next.js, Tailwind, and Prisma are Next.js docs/apps with `/_next/static/` assets.
- Angular uses a custom generated docs app with `adev` and `docs-content` assets.

## Scope

- Add a docs-engine detector for:
  - `vitepress`
  - `docusaurus`
  - `starlight`
  - `next`
  - `generated-static`
  - `spa`
- Add a typed capability result that can describe:
  - docs engine
  - source edit/source URL if known
  - search provider if known
  - page map if known
  - recommended capture method
- Store detected docs engine and site capability notes in artifact metadata.
- Keep existing `SiteModule` behavior working.

## Out of Scope

- Implementing every search connector.
- Implementing every source mapper.
- Adding bespoke parser logic for individual sites.

## Acceptance Criteria

- Vue and Vite are detected as VitePress from fixtures.
- Astro is detected as Starlight from fixtures.
- Redux Toolkit is detected as Docusaurus or Docusaurus-like from fixtures.
- Tailwind and Next.js are detected as Next.js docs/app pages.
- NestJS and TanStack are flagged as SPA/rendered candidates when static HTML is not readerable.
- Detector results distinguish verified capabilities from weak signals; a visible search button alone cannot mark search as supported.
- Fixtures include at least one saved HTML sample per detected engine.
- JSON output includes stable capability metadata without leaking diagnostics to stdout.

## Validation

```bash
pnpm test -- --run src/sites src/lib/research
pnpm type-check
```
