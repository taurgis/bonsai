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
    "content": "Cleaned main content markdown text…"
  }
}
```

The `data` block differs per command. See the [Command Reference](/reference/commands)
for each command's schema. `cache.status`, `cache.freshness`, and
`source.extractionConfidence` are the fields agents most often branch on.

When `list --json` caps results with `--limit`, the envelope includes a top-level
`truncation` object (`totalMatched`, `shown`, `limit`) while `data` stays the
capped array. Absence of `truncation` means nothing was cut — do not scrape
stderr for a tip (process stderr stays empty under `--json`).

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
| `CONFLICTING_FLAGS`      |                                               `2` | Mutually exclusive flags or source modes were combined.                    | Choose exactly one mode.                                         |
| `DUPLICATE_FLAG`         |                                               `2` | A single-value flag was passed more than once.                            | Remove the duplicate occurrence.                                 |
| `EMPTY_INPUT`            |                                               `2` | Import input was empty.                                                    | Provide non-empty Markdown.                                      |
| `FETCH_FAILED`           |                                               `1` | Network, HTTP, extraction, DNS, proxy, or SSRF runtime failure.            | Check the URL/network, retry later, or import manually.          |
| `FILE_NOT_FOUND`         |                                               `2` | Import `--file` path does not exist.                                       | Check the path or pipe content with `--stdin`.                   |
| `FILE_TOO_LARGE`         |                                               `1` | Import file exceeds the 1 MiB limit.                                       | Split or reduce the file.                                        |
| `INVALID_DURATION`       |                                               `2` | Duration flag is empty, malformed, or zero.                                | Use a value like `2h`, `7d`, or `6m`.                            |
| `INVALID_FLAG_VALUE`     |                                               `2` | Flag value not in the allowed set, or an empty URL/topic/tags filter.      | Use one of the values shown in the error.                        |
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
