---
"@taurgis/bonsai": patch
---

Manual CLI audit fix: a per-URL failure in a multi-URL `fetch`, `status`, or `inspect` batch (e.g. `bonsai https://ok.example https://blocked.example`) now renders as an `Error:` in human-readable output, matching the same failure standalone. Previously it was demoted to `Warning:` purely to avoid aborting the rest of the batch, which misleadingly read as non-fatal even though the row still fails the command (non-zero exit code, `ok: false`/error code in `--json`). The row still doesn't abort the batch — it now uses oclif's non-throwing `error(..., { exit: false })` renderer instead of `warn`, which prints the identical `Error: … / Code: … / Try this: …` block without stopping the loop. A genuine cache-miss row on `status`/`inspect` still renders as `Warning:`, since that's merely informational, not a failure of the lookup itself.

The same mislabeling existed in `prune`: a single entry that fails to delete (e.g. a permission error) still flips the whole command to exit 1, but was reported as `Warning: Failed to delete cache file ...`. It now renders as `Error:` too, while the remaining prune candidates still get processed.
