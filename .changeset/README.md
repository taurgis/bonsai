# Changesets

Bonsai (`@taurgis/bonsai`) uses Changesets for versioning, changelog generation, and npm releases.

## Common Commands

```bash
# Create a release note entry for a user-visible change
pnpm changeset

# Inspect pending release state
pnpm changeset:status

# Apply pending version and changelog updates locally
pnpm version-packages

# Publish pending releases
pnpm release
```

## Snapshot Releases

Use snapshot publishes only from throwaway branches or CI-only branches:

```bash
pnpm publish:snapshot
```

Do not merge snapshot version commits back to `main`.

## Changelog generator

Release PRs use `@changesets/changelog-git` instead of `@changesets/changelog-github`.
The GitHub-backed generator calls the GraphQL API during `changeset version`; on Node 22
that path intermittently fails with `Premature close` via `node-fetch@2` in
`@changesets/get-github-info` (see [changesets/changesets#2123](https://github.com/changesets/changesets/issues/2123)).
`changelog-git` builds entries from local git history only, so release CI does not depend on
GitHub API availability. We can switch back once Changesets v3 stabilises with native fetch.
