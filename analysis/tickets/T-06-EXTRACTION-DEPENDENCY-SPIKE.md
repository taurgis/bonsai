# T-06: Choose DOM and Extraction Dependencies Checklist

## Goal

Run a bounded dependency checklist and record the decision. This ticket should not grow into implementation architecture.

## User Stories

- `US-04.1` static HTML extraction
- `US-07.5` dependency review

## Depends On

- T-05

## Target Files

- spike notes in the plugin package docs or implementation PR description
- fixture tests under `src/lib/research`
- `package.json` and lockfile only after the spike chooses dependencies

## Output

Add a short note to the implementation PR or plugin package docs with:

- chosen DOM library
- chosen Markdown converter, if any
- dependency count before/after
- cold `node bin/cli.mjs --help` timing before/after
- reason not to copy the library into the repo

## Scope

- Test `@mozilla/readability` with `linkedom`.
- Compare against `jsdom` only if `linkedom` fails fixtures.
- Measure direct and transitive dependency count.
- Measure cold `--help` and cache-hit command startup before/after dependency additions.
- Confirm license posture.

## Fixture Set

- static documentation page
- article page with nav/sidebar/footer
- page with relative links
- page with code blocks
- page with tables
- malformed but common HTML

## Acceptance Criteria

- The chosen DOM implementation passes common docs fixtures.
- Readability returns useful title/content for fixtures.
- Scripts are not executed.
- Dependency choice is documented with package size/startup tradeoff.
- If `linkedom` fails, the reason for `jsdom` is explicit.
- No utility packages are added for TTL parsing, URL normalization, token estimates, cache keys, or frontmatter.

## Validation

```bash
pnpm install
pnpm test -- --run src/lib/research
pnpm test:contract
pnpm type-check
node bin/cli.mjs --help
```
