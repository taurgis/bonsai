---
"@taurgis/bonsai": patch
---

Manual CLI audit fix: a per-URL failure in a multi-URL `fetch` batch (e.g. `bonsai https://ok.example https://blocked.example`) now renders as an `Error:` in human-readable output, matching the same failure standalone. Previously it was demoted to `Warning:` purely to avoid aborting the rest of the batch, which misleadingly read as non-fatal even though the row still fails the command (non-zero exit code, `ok: false` in `--json`). The row still doesn't abort the batch — it now uses oclif's non-throwing `error(msg, { exit: false })` renderer instead of `warn`, which prints the identical `Error: … / Code: … / Try this: …` block without stopping the loop.
