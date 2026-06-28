# Regression suite

A single live, golden-file regression net for **all** documentation capture — both the custom site
integrations (custom `fetchPage`, e.g. `salesforce`, `salesforce-developer`) and the generic
docs-engine pipeline (`capturePage`). It fetches a curated set of real pages the way `research <url>`
would, normalizes the rendered Markdown, and diffs it against a committed baseline so a
fetch/extraction change can't silently drop content (code blocks, tables, images, steps) or leak
chrome/menu/placeholder noise that wastes agent tokens.

Each fixture is captured by one of two paths, chosen per fixture — there is no separate folder:

- **`site: "<id>"`** → the custom `SiteModule.fetchPage` (Salesforce LWR shadow-DOM extraction, …).
- **no `site`** → the generic `capturePage` pipeline (static → route/source Markdown → rendered fallback).

## Layout

- `fixtures.json` — the cases: `{ id, url, site?, expectEngine?, expectFramework?, focus }`.
  `focus` tags the content shape each case exercises (tables, code, sections, landing cleanup, …).
- `baseline/<id>.md` — committed expected output; the source of truth a run compares against.
- `baseline/<id>.timing.json` — committed capture duration (`durationMs`) for performance regression checks.
- `current/` — per-run output and `report.json` (git-ignored).

## Usage

Requires network access and a local Chrome (same as any real fetch).

```bash
pnpm regression:suite     # fetch every fixture, compare to baseline, write current/report.json
pnpm regression:promote   # adopt current output as the new baseline (after an intended change)
node testing/regression/run-suite.mjs --promote-timing   # refresh timing baselines only
pnpm regression:check     # strict: non-zero exit on drift, new, failed, leaking, or >15% slower capture

# Run a subset by id substring (the Salesforce fixtures are slow/rendered; this skips them):
node testing/regression/run-suite.mjs vue node mdn tailwind
```

Each line reports a state: `same`, `changed`, `LOSS` (a structural metric dropped vs baseline —
likely lost content), `new` (no baseline yet), or `error`, plus capture duration in milliseconds
(with `%` delta vs `baseline/<id>.timing.json` when present), and any `✗ LEAK` of chrome noise.
Strict mode also fails when capture duration regresses more than **15%** vs the timing baseline.

## Coverage

- **Custom integrations**: Salesforce Help + Salesforce Developer (LWR shadow-DOM, API references).
- **Generic pipeline** (popular libraries + every docs engine): VitePress (Vue, Vite — route/source
  Markdown), GitHub source (Node `path`, **Node `fs`** huge reference, MDN `Array.map`/`Promise`,
  TanStack `useQuery`/`useQueries`, Docusaurus/Jest, Next.js, Docsy/Kubernetes — these expose an
  "edit this page" link, so capture prefers exact source Markdown), static HTML (React, Tailwind,
  Redux, Astro/Starlight, Sphinx/Python, **pandas/Sphinx** dense field-list reference, mdBook/Rust
  Book, TypeScript, GitBook, Mintlify, Just the Docs), and rendered fallback (NestJS, Docsify,
  Svelte).

The leakage gate (`leakageSignals`) fails on raw chrome HTML, base64 images, nav/"on this page"/
theme/cookie chrome, app-shell "Loading…", empty `[](url)` links, and unrendered template macros
(`{{jsxref(…)}}`). Inherently dynamic or oversized pages are kept out of the baseline to avoid
churn: ReadMe's live API explorer, and Redoc/OpenAPI references (e.g. the Docker Engine API) whose
rendered output is a 270 KB+ single page that drifts on any endpoint tweak — the `redocly` detector
branch is covered by the `redocly.html` unit fixture instead.

## The "semi requirement"

`tests/regression/fixtures.test.ts` runs in the normal `pnpm test` suite (no network) and fails if a
site with a custom `fetchPage` has no fixtures here, so adding a new custom integration without
baseline coverage breaks the build. The generic pipeline is shared and covered by unit tests plus
the docs fixtures above, so site-less fixtures are allowed and not individually required.

## Workflow when output changes

1. Run `pnpm regression:suite` and inspect the diff in `current/` vs `baseline/`.
2. If the change is intended (and no unexpected `LOSS`/`LEAK`), run `pnpm regression:promote` and
   commit the updated `baseline/`.
3. If it's a regression, fix the fetch/extraction and re-run.
