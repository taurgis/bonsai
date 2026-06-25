# Share your cache with a team

By default Bonsai stores research in a machine-wide global cache that only you
see. When a repository's research should travel with the code, switch that repo
to **project** storage and commit the cache. Teammates and CI then read the same
captured docs instead of re-fetching them.

This guide assumes you have Bonsai installed and a repository to work in. See
[Storage Modes](/concepts/storage-modes) for the underlying model.

## 1. Switch the repo to project storage

From the repository root:

```bash
npx @taurgis/bonsai config set storage project --local
```

`--local` writes the setting to `.bonsai.json` in the current directory, so it
applies to this repo only and travels with it. New research now lands in
`./.bonsai/research/` instead of the global cache.

## 2. Fetch some research

Cache the pages your project relies on, exactly as before:

```bash
npx @taurgis/bonsai https://nodejs.org/api/url.html
npx @taurgis/bonsai https://react.dev/reference/react/useEffect
```

Confirm where each entry landed:

```bash
npx @taurgis/bonsai list
```

The paths now point inside the repo (`.../<repo>/.bonsai/research/…`).

## 3. Commit the cache

`.bonsai.json` and `.bonsai/research/` are designed to be committed:

```bash
git add .bonsai.json .bonsai/research
git commit -m "Add shared research cache"
```

A teammate who checks out the repo, or a CI job that clones it, picks up the
`project` setting from `.bonsai.json` and reads the committed cache. A request
that hits a committed entry is served locally with no network call.

## 4. Reads fall back to global

Under `project` storage, a lookup checks the project cache first and then the
global cache. So a teammate still benefits from their own machine-wide research
for anything the repo hasn't captured, while the committed cache covers what the
project depends on. A key present in both is served from the project copy.

## Secrets never reach the committed cache

Because the project cache is committed, Bonsai scans content for credentials
(API keys, bearer/JWT tokens, private-key blocks, `secret=` / `token=`
assignments) **before** writing under `project` storage. On a match it:

- redirects that artifact to the **global** cache instead,
- prints a warning naming the credential *type* (never its value), and
- sets `redirectedToGlobal: true` in the `--json` envelope.

The guard is automatic, but treat the cache like any other committed artifact and
review what lands in it. See [Storage Modes](/concepts/storage-modes#secret-safety-routing).

## Override for a single run

To send one fetch to a different location without changing the repo's setting,
use the `--storage` flag or the `BONSAI_STORAGE` environment variable:

```bash
# Cache this one page globally, even in a project-storage repo
npx @taurgis/bonsai https://example.com/private-ish --storage global
```

The full precedence order (flag → env var → project config → user config →
default) is in [Configuration](/reference/configuration#precedence).
