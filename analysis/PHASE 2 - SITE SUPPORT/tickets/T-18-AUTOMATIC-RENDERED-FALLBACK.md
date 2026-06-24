# T-18: Automatically Retry SPA Docs With Rendered Extraction

## Goal

Automatically use browser-rendered extraction when static fetch cannot produce a useful article.

## Evidence

- `https://docs.nestjs.com/` failed static Readability extraction and succeeded with `--rendered`.
- TanStack Query is already configured with rendered defaults and produced high-confidence content.
- Svelte returned only medium confidence on a static overview page and needs deeper fixture validation.

## Scope

- Add fallback triggers:
  - Readability parse failure.
  - extracted text below threshold.
  - app-shell markers and script-heavy HTML.
  - known docs-engine or site capability recommends rendered extraction.
- Preserve existing DNS safety, redirect limits, timeout, body-size limits, and cache overwrite protections.
- Record both attempted capture methods in metadata when fallback occurs.
- Keep explicit `--rendered` behavior unchanged.

## Out of Scope

- Replacing static fetch as the default.
- Rendering private/local URLs.

## Acceptance Criteria

- NestJS static failure automatically retries rendered and returns a successful artifact.
- Static pages such as Vue, Vite, and MDN do not render unnecessarily.
- JSON mode remains one clean JSON document.
- Fetch failures never overwrite a previous good cache artifact.

## Validation

```bash
pnpm test -- --run src/lib/research/browser src/commands/research
pnpm type-check
```

