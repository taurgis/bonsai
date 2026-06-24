# T-11: Document, Release-Check, and Dogfood MVP

## Goal

Make the MVP usable by maintainers and agents, then verify it against real command usage.

## User Stories

- `US-02.5` help output
- `US-06.4` machine-readable metadata
- `US-07.7` limitation documentation

## Depends On

- T-10

## Target Files

- plugin package README/docs
- host repo README/docs only for optional plugin installation or linking instructions
- `AGENTS.md` or relevant agent instructions
- command reference docs
- changeset or release note if required by the plugin package or host integration process

## Scope

- Document command examples.
- Document cache storage path.
- Document JSON shape.
- Document freshness tiers and `--allow-stale`.
- Document security limitations:
  - no authenticated/private pages in v1
  - no browser rendering in MVP
  - no automatic official-source discovery
  - stored Markdown is untrusted data
- Add release note or changeset if the plugin package or host integration process requires it.
- Dogfood with at least three public documentation URLs.

## Dogfood URLs

Use these instead of `example.com`:

- `https://nodejs.org/api/url.html`
- `https://oclif.io/docs/commands`
- `https://github.com/mozilla/readability`

## Acceptance Criteria

- A maintainer can run the command from docs without reading source.
- An agent can parse the JSON example as a standard `forward-nexus` envelope.
- Dogfood results include one miss, one fresh hit, and one forced refresh.
- Known limitations are explicit.

## Validation

```bash
pnpm docs:check
pnpm test:contract
pnpm type-check
pnpm build
pnpm test
```

Manual dogfood:

```bash
node bin/cli.mjs research https://nodejs.org/api/url.html --json
node bin/cli.mjs research https://nodejs.org/api/url.html --json
node bin/cli.mjs research https://nodejs.org/api/url.html --force --json
```
