# T-28: Support Client-Rendered Markdown Docs Such as Docsify

## Goal

Add a generic path for Docsify-style documentation sites that load Markdown client-side instead of generating static HTML.

## Evidence

- Docsify rendered extraction succeeded with medium confidence.
- The sampled Docsify page states that Docsify loads and parses Markdown on the fly rather than generating static HTML.
- The sampled page exposed an edit link to `docs/README.md`.

## Scope

- Detect Docsify app shells and hash routes.
- Prefer source Markdown from edit links or route mapping.
- Fetch `_sidebar.md` and `_navbar.md` only when same-origin/repository mapping is verified.
- Use rendered fallback if source mapping fails.

## Out of Scope

- Arbitrary SPA docs frameworks.
- Executing Docsify plugins outside the browser fallback.

## Acceptance Criteria

- Docsify fixture is detected from static HTML/app shell markers.
- Rendered fixture produces content when source mapping is unavailable.
- Source Markdown fixture is preferred when edit link mapping is available.
- Hash route URLs normalize consistently in cache keys.

## Validation

```bash
pnpm test -- --run src/lib/research src/sites
pnpm type-check
```
