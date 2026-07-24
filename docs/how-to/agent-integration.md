# Agent Integration

Bonsai is built to be driven by AI agents and scripts, not just humans. Two
features make that reliable: a **stable JSON envelope** and **deterministic exit
codes**.

## JSON output

Pass `--json` to any command to get a machine-readable envelope with a stable
shape:

```json
{
  "schemaVersion": 1,
  "command": "bonsai",
  "ok": true,
  "exitCode": 0,
  "stdout": "",
  "stderr": "",
  "data": {
    "cache": {
      "key": "0f115db0…e9d7",
      "status": "hit",
      "freshness": "fresh",
      "path": "/…/research/0f115db0…e9d7.md",
      "storage": "global",
      "redirectedToGlobal": false
    },
    "source": {
      "url": "https://example.com",
      "normalizedUrl": "https://example.com/",
      "captureMethod": "static_fetch",
      "extractionStatus": "extracted",
      "extractionConfidence": "low",
      "qualityNotes": ["readability extracted main article"],
      "fetchedAt": "2026-06-24T07:33:20.519Z",
      "validatedAt": "2026-06-24T07:33:20.519Z",
      "staleAfter": "2026-07-24T07:33:20.519Z"
    },
    "format": "compressed",
    "tokenEstimate": 29,
    "detailedTokenEstimate": 65,
    "content": "Cleaned main content markdown text…"
  }
}
```

The `data` block differs per command. See the [Command Reference](/reference/commands)
for each command's schema. `cache.status`, `cache.freshness`, and
`source.extractionConfidence` are the fields agents most often branch on.
`detailedTokenEstimate` is always the true `detailed`-format size, even on a
`compressed` fetch — see [Compression &
Budgeting](/concepts/compression#knowing-how-much-detail-was-cut) for how to
use it and when the human-mode tip toward `--format detailed` appears.

`list --json`/`--toon` always includes a top-level `summary` object alongside
`data`: `total` (entries matched before `--limit`), `shown` (entries actually
returned), `limit`, `truncated` (`total > shown`), `empty` (`total === 0`, an
explicit signal so a zero-result `data: []` is never ambiguous), and
`byFreshness` (a `fresh`/`stale_grace`/`stale_expired` count over the matched
set) — a cache-wide aggregate without a second round trip. Do not scrape
stderr for a truncation tip; process stderr stays empty under `--json`.

`list`'s default row is intentionally minimal — `sourceUrls`, `topic`,
`freshness`, and `tokenEstimate` — the fields needed to judge relevance and
act next. Pass `--full` for every metadata field (cache key, path, artifact
type, tags, capture method, quality notes, timestamps).

`list` filters by exact metadata (`--topic`, `--tags`, `--url`, `--freshness`,
`--artifact-type`, `--capture-method`); reach for `bonsai search --query "…"`
when the lookup is by keyword instead — it ranks the same page-level cache by
a query matched against topic, tags, `summary`, and `compressed` content, and
adds a `score`, `matchedFields`, and a short `snippet` to each row so an agent
can judge relevance without a second `inspect` round trip. `search` reads
only the already-indexed `summary`/`compressed` text, never the larger
`detailed` body, so it stays cheap even against a large cache; see
[Command Reference](/reference/commands#search) for the full flag/JSON
contract.

Running `bonsai` with no arguments at all shows live cache data (equivalent to
`bonsai list`) instead of the root help text — the CLI answers "what do I
have?" by default. That bare invocation also prints a two-line identity
header first (`bin: <path>`, `description: <one sentence>`) so an agent
orients on the tool itself before the data; the header is human-mode only and
does not appear on an explicit `bonsai list` or under `--json`/`--toon`.
`bonsai help`, `bonsai --help`, and `-h` remain the explicit path to the
command reference.

## TOON output

Pass `--toon` instead of `--json` to get the identical envelope — same
`schemaVersion`, `data`, `code`, `exitCode`, all of it — encoded as
[TOON](https://toonformat.dev/) (Token-Oriented Object Notation) instead of
JSON. TOON is a YAML-indentation, CSV-tabular encoding built for LLM prompts;
on mixed-structure data it runs roughly 40% fewer tokens than the equivalent
JSON, per the format's own published benchmarks. Reach for it when a caller is
token-constrained and doesn't need to be JSON specifically — anything that can
`JSON.parse` an envelope can also `decode()` a TOON one with the
[`@toon-format/toon`](https://www.npmjs.com/package/@toon-format/toon) package.

```
$ bonsai list --toon
schemaVersion: 1
command: list
ok: true
exitCode: 0
stdout: ""
stderr: ""
data[1]:
  - sourceUrls[1]: "https://nodejs.org/api/url.html"
    topic: Node.js URL API
    freshness: fresh
    tokenEstimate:
      compressed: 29
      detailed: 65
summary:
  total: 1
  shown: 1
  limit: 10
  truncated: false
  empty: false
  byFreshness:
    fresh: 1
    stale_grace: 0
    stale_expired: 0
  nextCommand: null
```

TOON's tabular `data[N]{field,...}:` header form only applies to arrays of
records with uniform primitive fields. `list`'s row has a nested `tokenEstimate`
object and a `sourceUrls` array, so the encoder falls back to one indented
mapping per row instead — the tradeoff for `--full` is the same, since every
row there also carries `tags`, `qualityNotes`, and `tokenEstimate`.

`--json` and `--toon` are mutually exclusive — passing both fails fast with
`CONFLICTING_FLAGS` (exit `2`) rather than silently picking one.

## Read-only / plan mode

Use `--read-only` (alias `--plan`), `BONSAI_READ_ONLY=1`, or `BONSAI_PLAN_MODE=1` when an agent
must avoid filesystem mutations. The mode is global and compositional: once active for a process,
there is no per-command flag to force writes back on.

- Fetch still performs network reads and returns content, but cache misses/refreshes are previewed
  without persisting artifacts.
- `import` reports `dryRun: true` and `cache.status: "would_import"`.
- `config set` / `config unset` report `dryRun: true` with `status: "would_set"` /
  `"would_unset"` and leave config files unchanged.
- `prune` treats read-only as an implicit dry run; combining read-only mode with `--yes` exits `2`
  with `READ_ONLY_MODE`.

## Exit codes

Every command returns a distinct exit code so callers can react without parsing
text:

| Code | Meaning               | Cause                                                                                                                                | What to do                                                                  |
| ---- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `0`  | Success               | Command succeeded, or a valid cache hit was returned.                                                                                | Continue.                                                                   |
| `1`  | General failure       | DNS block, timeout, invalid host, TLS error, or HTTP ≥ 400.                                                                          | Check connectivity / URL / that the host is public.                         |
| `2`  | Usage error           | Invalid flags, missing arguments, bad `--stdin` usage, an unknown command or typo, or a URL missing its `http://`/`https://` scheme. | Re-check `--help`; supply a full URL with a scheme.                         |
| `5`  | Offline stale warning | Remote unreachable; stale cache served from inside the grace window.                                                                 | Content is usable but unverified. Pass `--allow-stale` to exit `0` instead. |

`--json`'s `ok` field stays `true` for exit code `5` (content was served, just unverified) — an
integration that branches only on `ok` will miss the stale-serve signal. Check `exitCode` (or
`data.cache.status`) too, not `ok` alone.

## Output channels (and a deliberate AXI divergence)

Bonsai broadly follows the [Agent eXperience Interface
(AXI)](https://github.com/kunchenguid/axi) guidelines for agent-friendly CLIs, but diverges on one
point on purpose: AXI's [structured-errors
principle](https://github.com/kunchenguid/axi/blob/main/.agents/skills/axi/SKILL.md#output-channels)
calls for errors on stdout in every mode. Bonsai does that under `--json`/`--toon` — the error
envelope (`ok: false`, `code`, `content: null`) is the same stdout JSON/TOON shape a success
response uses, so a machine caller never has to read two streams to get the full picture. In
**human/text mode**, errors go to **stderr** instead, following [clig.dev's stdout-is-data,
stderr-is-diagnostics convention](https://clig.dev/#output). Warnings (security- and
freshness-relevant notices like a secret-routing redirect or a stale-serve) go to stderr in both
modes — they're side effects the envelope's `ok`/`data` shouldn't be blocked on, but a caller
should still be able to see.

This is a mode-scoped divergence, not a blanket one: an agent driving Bonsai through `--json`/
`--toon` already gets AXI's guarantee; the stderr split only applies to interactive/piped human
terminal use, which Bonsai also has to serve well.

## Stable error code catalog

When a failure has a stable `code`, agents should branch on `code` first and
`exitCode` second. New stable codes belong in this catalog before they ship.
Some codes are intentionally shared across commands when the recovery action is
the same; for example, `CONFLICTING_FLAGS` always means "choose one of the
mutually exclusive options", regardless of which flags conflicted.

| Code                     |                                              Exit | Meaning                                                                    | Typical recovery                                                 |
| ------------------------ | ------------------------------------------------: | -------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `CACHE_MISS`             |                                               `1` | `status`/`inspect` could not find a cached artifact.                       | Fetch or import the URL first.                                   |
| `COMMAND_NOT_FOUND`      |                                               `2` | Command or topic does not exist.                                           | Use the suggested command or run `bonsai help`.                  |
| `CONFIG_DIR_UNAVAILABLE` |                                               `1` | User-level config directory is unavailable.                                | Use `--local` for project config.                                |
| `CONFLICTING_FLAGS`      |                                               `2` | Mutually exclusive flags or source modes were combined (e.g. `--json` with `--toon`). | Choose exactly one mode.                                         |
| `DUPLICATE_FLAG`         |                                               `2` | A single-value flag was passed more than once.                            | Remove the duplicate occurrence.                                 |
| `EMPTY_INPUT`            |                                               `2` | Import input was empty.                                                    | Provide non-empty Markdown.                                      |
| `FETCH_FAILED`           |                                               `1` | Network, HTTP, extraction, DNS, proxy, or SSRF runtime failure.            | Check the URL/network, retry later, or import manually.          |
| `FILE_NOT_FOUND`         |                                               `2` | Import `--file` path does not exist.                                       | Check the path or pipe content with `--stdin`.                   |
| `FILE_TOO_LARGE`         |                                               `1` | Import file exceeds the 1 MiB limit.                                       | Split or reduce the file.                                        |
| `INVALID_DURATION`       |                                               `2` | Duration flag is empty, malformed, or zero.                                | Use a value like `2h`, `7d`, or `6m`.                            |
| `INVALID_FLAG_VALUE`     |                                               `2` | Flag value not in the allowed set, or an empty URL/topic/tags filter.      | Use one of the values shown in the error.                        |
| `INVALID_HOOK_FILE`      |                                               `1` | `setup`'s target hook file exists but isn't a single JSON object.          | Fix or remove the file by hand, then re-run `setup`.             |
| `INVALID_LIMIT`          |                                               `2` | `--limit` is not an integer from 1 to 100.                                 | Pick an integer in range.                                        |
| `INVALID_METADATA_VALUE` |                                               `2` | `--topic` or `--tags` contains a line break, or exceeds its length cap (200/100 chars). | Remove line breaks, or shorten the value.            |
| `INVALID_URL`            | `2` for single URL, `1` for multi-URL row failure | URL could not be parsed or uses an unsupported scheme.                     | Provide a valid `http://` or `https://` URL.                     |
| `INVALID_VALUE`          |                                               `2` | Config value is not valid for the selected key.                            | Use one of the listed values.                                    |
| `IO_ERROR`               |                                               `1` | Import failed while reading stdin or a file.                               | Check permissions or retry with a different input source.        |
| `META_RENDER_FAILED`     |                                               `1` | JSON help/version rendering failed before command execution.               | Retry without meta flags or report a CLI bug.                    |
| `MISSING_ARGUMENT`       |                                               `2` | Required command argument is absent.                                       | Check command usage.                                             |
| `MISSING_COMMAND`        |                                               `2` | Invocation had no URL or command after global/meta flags were normalized.  | Pass a URL or named command.                                     |
| `MISSING_FILTER`         |                                               `2` | `prune` was run without any pruning filter.                                | Add `--older-than`, `--inactive`, `--artifact-type`, `--url`, `--topic`, or `--tags`. |
| `MISSING_FLAG_VALUE`     |                                               `2` | A flag that requires a value was provided without one.                     | Provide the value or remove the flag.                            |
| `MISSING_INPUT`          |                                               `2` | `import` has no `--stdin` or `--file` input source.                        | Pipe Markdown, use `--file -`, or pass `--file notes.md`.        |
| `MISSING_STDIN`          |                                               `2` | `--stdin` was selected but no data arrived.                                | Pipe content or use `--file`.                                    |
| `MISSING_TOPIC`          |                                               `2` | Multi-source import lacks `--topic`.                                       | Add a topic.                                                     |
| `MISSING_URL`            |                                               `2` | Import has neither a positional URL nor `--source-url`.                    | Provide a source URL.                                            |
| `MISSING_URL_SCHEME`     | `2` for single URL, `1` for multi-URL row failure | URL-like input omitted `http://` or `https://`.                            | Add the scheme.                                                  |
| `NOT_A_FILE`             |                                               `2` | Import `--file` path is not a regular file.                                | Pass a Markdown file or pipe content.                            |
| `PRUNE_PARTIAL_FAILURE`  |                                               `1` | Some prune candidates could not be deleted.                                | Inspect file permissions for the returned paths.                 |
| `READ_ONLY_MODE`         |                                               `2` | A write-confirming flag was used while read-only/plan mode is active.      | Preview instead or disable read-only mode.                       |
| `SAFETY_CHECK_REQUIRED`  |                                               `2` | `prune` needs explicit `--dry-run` or `--yes`.                             | Preview first, then rerun with `--yes` if correct.               |
| `STDIN_TOO_LARGE`        |                                               `1` | Import stdin exceeds the 1 MiB limit.                                      | Split or reduce the input.                                       |
| `UNEXPECTED_ARGUMENT`    |                                               `2` | Extra positional arguments were supplied.                                  | Remove the extra argument or check usage.                        |
| `UNKNOWN_AGENT`          |                                               `2` | `setup`'s `agent` argument isn't a supported target.                       | Use one of the agents listed in the error.                       |
| `UNKNOWN_FLAG`           |                                               `2` | Flag is not defined for the command.                                       | Use the suggested flag or check help.                            |
| `UNKNOWN_KEY`            |                                               `2` | Config key is not recognized.                                              | Use the suggested key or one from the valid-key list.            |

## A cache-first workflow

Agents get the most value by fetching through Bonsai once they know the official URL:

1. **Plan** with `status` to see what a fetch _would_ do, without doing it:
   ```bash
   bonsai status https://nodejs.org/api/url.html --json
   ```
2. **Fetch** only when needed; use `--dry-run` to validate extraction before
   committing it to the cache:
   ```bash
   bonsai https://nodejs.org/api/url.html --dry-run --json
   ```
3. **Synthesize** multi-source notes back into the cache with
   [`import`](/how-to/importing-synthesis) and repeated `--source-url` flags so
   the synthesis stays source-cited:
   ```bash
   cat synthesis.md | bonsai import --stdin --topic "Auth" \
     --source-url https://a.example --source-url https://b.example --json
   ```

Because URLs are normalized and output is deterministic, the same request yields
the same cache key and the same bytes, repeatable across runs and machines.

## Ambient session context

Everything above is on-demand: an agent has to know to call Bonsai. `bonsai setup <agent>`
installs a `SessionStart` hook that runs `bonsai context` at the start of every session, so the
cache's current state is visible before the agent does anything (the [AXI ambient-context
principle](https://github.com/kunchenguid/axi/blob/main/.agents/skills/axi/SKILL.md#7-ambient-context-via-session-integrations)).

```bash
# Project-scoped (shareable via version control; the default):
bonsai setup claude-code
bonsai setup codex

# User-level, machine-only:
bonsai setup claude-code --global
```

`bonsai context` (what the hook runs) prints a short, directory-scoped summary — total cached
entries, a freshness breakdown, and the most recently touched pages — capped to a handful of
entries so the per-session cost stays small:

```
bonsai cache: 3 entries (2 fresh, 1 stale_grace, 0 stale_expired)
- [Node URL API] fresh — https://nodejs.org/api/url.html
- [React Suspense] fresh — https://react.dev/reference/react/Suspense
- [Auth Guide] stale_grace — https://example.com/auth
Tip: research a new page: bonsai <url>
```

`setup` is idempotent and self-repairing: re-running it after nothing changed is a silent no-op,
and re-running it after Bonsai was reinstalled to a new path updates the hook's command in place,
without touching any other hooks already in the file. Preview either behavior with
`--dry-run --json` before writing anything.

**Not yet supported: OpenCode.** AXI's own guidance recommends OpenCode's plugin system for the
same ambient-context pattern, but OpenCode's plugin docs don't yet document a confirmed hook
signature for injecting session-start context — `setup` won't guess at one. Passing `opencode`
to `setup` explains this and points back here.
