# Storage Modes

Bonsai can keep its research cache in one of two places. The active mode decides
where new artifacts are written and which caches are read.

| Mode | Cache location | Read behavior |
| --- | --- | --- |
| `global` (default) | OCLIF data dir (`<dataDir>/research/`) | Reads the global cache only. |
| `project` | `<cwd>/.bonsai/research/` (committable) | Reads the project cache first, then falls back to the global cache. |

## Choosing a mode

Use **global** for personal, machine-wide research that every project on your
machine can reuse. Use **project** when the cache should travel *with a
repository*, so teammates and CI reuse the same captured docs.

```bash
# Store this project's cache inside the repo
npx @taurgis/bonsai config set storage project --local

# Set the user-wide default
npx @taurgis/bonsai config set storage global
```

You can also override per run with `--storage`, or with the `BONSAI_STORAGE`
environment variable. See [Configuration](/reference/configuration) for the full
precedence chain.

## Read fallback (project → global)

When `storage` resolves to `project`, reads check the project cache first and
then fall back to the global cache. A key present in both is served from the
**project** copy. Writes go to the project cache, except as noted below.

## Secret-safety routing

The project cache is meant to be committed, so it must never hold credentials.
Before any write under `project` storage, the artifact's content is scanned for
known secret patterns: API keys, bearer/JWT tokens, private-key blocks,
`secret=` / `token=` assignments, and similar.

On a match the artifact is **redirected to the global cache**:

- a warning naming the credential *type* (never its value) is printed, and
- the JSON envelope sets `redirectedToGlobal: true`.

Global storage is not scanned, because it is never committed.

::: tip Committing the project cache
The `.bonsai/research/` directory is designed to be committed and shared. The
secret-routing guard makes that safe by default, but treat the cache
like any other source artifact and review what lands in it.
:::
