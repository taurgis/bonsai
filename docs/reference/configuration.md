# Configuration

Bonsai has two configuration keys. Both can be set persistently with the
[`config`](/reference/commands#config) command or overridden per run.

## Keys

| Key | Values | Default | Effect |
| --- | --- | --- | --- |
| `storage` | `global`, `project` | `global` | Where new research artifacts are cached. See [Storage Modes](/guide/storage-modes). |
| `summary` | `conservative`, `balanced`, `aggressive` | `conservative` | How aggressively the `compressed` variant is shortened when structural compression alone leaves it close to `detailed`. See [Compression](/guide/compression). |

Headings, code blocks, tables, and lists are always preserved regardless of the
`summary` value — only prose is condensed, and never with an LLM.

## Precedence

Configuration is layered. For a given run the effective value is resolved in
this order (first match wins):

1. Per-command flag — `--storage` (`fetch`/`import`)
2. Environment variable — `BONSAI_STORAGE` / `BONSAI_SUMMARY`
3. Project config — `.bonsai.json` in the current working directory
4. User config — `config.json` in the OCLIF config directory
5. Built-in default — `storage=global`, `summary=conservative`

## Managing values

```bash
# Set the project-level value (writes ./.bonsai.json)
npx @taurgis/bonsai config set storage project --local

# Set the user-wide default
npx @taurgis/bonsai config set summary balanced

# Inspect values
npx @taurgis/bonsai config get storage          # effective value
npx @taurgis/bonsai config get storage --local  # project file only
npx @taurgis/bonsai config list                 # all keys

# Remove a key (restores the default)
npx @taurgis/bonsai config unset storage --local
```

### Flags

- `--global` / `-g` — target the user-level config file (default for `set`/`unset`).
- `--local` / `--project` / `-p` — target the project-level file (`.bonsai.json`).
- `--dry-run` — show the change without writing.
- `--json` — machine-readable envelope.

## File locations

- **Project config:** `.bonsai.json` in the working directory (committable).
- **User config:** `config.json` in the OCLIF config directory for the `bonsai`
  binary.
- **Project cache artifacts:** `.bonsai/research/` (see [Cache Protocol](/reference/cache-protocol)).
