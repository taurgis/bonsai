# Regression suite

A live, golden-file regression net for the **custom site integrations** (those with a custom
`fetchPage`, e.g. `salesforce`, `salesforce-developer`). It fetches a curated set of real doc pages
through the actual site module, normalizes the rendered Markdown, and diffs it against a committed
baseline so a fetch/extraction change can't silently drop content (code blocks, tables, images,
steps) before it's noticed.

Ported from the legacy `b2c-plugin-docs-viewer` suite and adapted to the multi-site architecture.

## Layout

- `fixtures.json` — the cases: `{ id, site, url, focus }`. `site` is a site-module id; `focus` tags
  the content shape each case is meant to exercise (tables, code, nested request bodies, …).
- `baseline/<id>.md` — committed expected output. The source of truth a run compares against.
- `current/` — per-run output and `report.json` (git-ignored).

## Usage

Requires network access and a local Chrome (same as any real fetch).

```bash
pnpm regression:suite     # fetch every fixture, compare to baseline, write current/report.json
pnpm regression:promote   # adopt current output as the new baseline (after an intended change)
pnpm regression:check     # strict: non-zero exit on any drift, new, or failed fixture (for CI)
```

Each line reports a state: `same`, `changed`, `LOSS` (a structural metric dropped vs baseline —
likely lost content), `new` (no baseline yet), or `error`.

## The "semi requirement"

`tests/regression/fixtures.test.ts` runs in the normal `pnpm test` suite (no network) and fails if a
site with a custom `fetchPage` has no fixtures here. So adding a new custom integration without
baseline coverage breaks the build — coverage is required by construction, while the live diff stays
an explicit, opt-in step.

## Workflow when output changes

1. Run `pnpm regression:suite` and inspect the diff in `current/` vs `baseline/`.
2. If the change is intended (and no `LOSS` you didn't expect), run `pnpm regression:promote` and
   commit the updated `baseline/`.
3. If it's a regression, fix the fetch/extraction and re-run.
