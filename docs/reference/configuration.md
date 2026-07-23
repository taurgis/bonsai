# Configuration

Bonsai has two configuration keys. Both can be set persistently with the
[`config`](/reference/commands#config) command or overridden per run.

## Keys

| Key | Values | Default | Effect |
| --- | --- | --- | --- |
| `storage` | `global`, `project` | `global` | Where new research artifacts are cached. See [Storage Modes](/concepts/storage-modes). |
| `summary` | `conservative`, `balanced`, `aggressive` | `conservative` | How aggressively the `compressed` variant is shortened when structural compression alone leaves it close to `detailed`. See [Compression](/concepts/compression). |

Headings, code blocks, tables, and lists are always preserved regardless of the
`summary` value. Only prose is condensed, and never with an LLM.

## Precedence

Configuration is layered. For a given run the effective value is resolved in
this order (first match wins):

1. Per-command flag: `--storage` (`fetch`/`import`)
2. Environment variable: `BONSAI_STORAGE` / `BONSAI_SUMMARY`
3. Project config: `.bonsai.json` in the current working directory
4. User config: `config.json` in the OCLIF config directory
5. Built-in default: `storage=global`, `summary=conservative`

## Managing values

```bash
# Set the project-level value (writes ./.bonsai.json)
npx @taurgis/bonsai config set storage project --local

# Set the user-wide default
npx @taurgis/bonsai config set summary balanced

# Inspect values
npx @taurgis/bonsai config get storage          # effective value
npx @taurgis/bonsai config get storage --local  # project file only; JSON includes configured:false when unset
npx @taurgis/bonsai config list                 # all keys (`--json` → [{ key, value, configured }, ...])

# Remove a key (restores the default)
npx @taurgis/bonsai config unset storage --local
```

### Flags

- `--global` / `-g`: target the user-level config file (default for `set`/`unset`).
- `--local` / `--project` / `-p`: target the project-level file (`.bonsai.json`).
- `--dry-run`: show the change without writing.
- `--read-only` / `--plan`: inherited global flag; (`set`/`unset`) preview without writing.
- `--toon`: emit the same envelope as `--json`, encoded as TOON (fewer tokens). Mutually exclusive with `--json`.
- `--json`: machine-readable envelope.

## File locations

- **Project config:** `.bonsai.json` in the working directory (committable).
- **User config:** `config.json` in the OCLIF config directory for the `bonsai`
  binary.
- **Project cache artifacts:** `.bonsai/research/` (see [Cache Protocol](/reference/cache-protocol)).

## Invalid or corrupted values

An unrecognized `BONSAI_STORAGE`/`BONSAI_SUMMARY` value, or a config file that
is not valid JSON, or holds an invalid value for a known key, is never applied
silently. Bonsai prints a warning to stderr naming the offending file, key, or
env var, then falls back to the next layer in the precedence order above (or
the built-in default). `--json` output is unaffected — the warning never
appears on stdout, so scripts parsing the envelope see only the resolved
value.
