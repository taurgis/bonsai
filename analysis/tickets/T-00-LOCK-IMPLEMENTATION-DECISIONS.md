# T-00: Lock Implementation Decisions

## Goal

Convert unresolved pre-ticket decisions into explicit MVP scope so implementation tickets do not depend on hidden choices.

## User Stories

- `US-01.1` delivery model decision
- `US-01.2` target CLI conventions
- `US-07.5` dependency footprint and license posture

## Scope

- Record the MVP as an optional oclif plugin package developed in this repository.
- Record the host integration path for local dogfooding without adding `research` as a core command in `forward-nexus`.
- Record URL-first cache identity.
- Record static fetch first; no browser rendering in MVP.
- Record `--tier standard` default with optional `--ttl` override.
- Record stale-within-grace behavior:
  - exit `0` only when stale serving is explicitly allowed
  - exit `5` for partial success otherwise
- Record dependency policy:
  - use Node stdlib for fetch, URL parsing, hashing, atomic writes, token estimates, and small helpers
  - dependency candidates are `@mozilla/readability`, `linkedom` or `jsdom`, and `turndown`
  - defer Playwright/Puppeteer

## Target Files

- `analysis/pre-ticket/DECISIONS-AND-OPEN-QUESTIONS.md`
- `analysis/pre-ticket/TARGET-CLI-INTEGRATION.md`
- plugin package scaffold files in this repository once they exist
- `/Users/thomastheunen/Documents/Projects/forward-nexus/analysis/CONTRACT.md` only if host integration changes command contracts
- `/Users/thomastheunen/Documents/Projects/forward-nexus/docs/commands.md` only if host integration changes user-facing command docs

## Acceptance Criteria

- No implementation ticket depends on unresolved delivery model, freshness, storage, or dependency policy.
- Deferred items are named explicitly and not mixed into MVP acceptance criteria.
- The decision record explains why this is an optional plugin and how the host loads it for dogfooding.

## Validation

- Read every remaining implementation ticket and confirm it has no unresolved product scope.
- Confirm ticket sequence still matches `analysis/user-stories/README.md` suggested MVP cut.
