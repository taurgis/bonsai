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
