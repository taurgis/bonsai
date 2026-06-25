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

The `data` block differs per command — see the [Command Reference](/reference/commands)
for each command's schema. `cache.status`, `cache.freshness`, and
`source.extractionConfidence` are the fields agents most often branch on.

## Exit codes

Every command returns a distinct exit code so callers can react without parsing
text:

| Code | Meaning | Cause | What to do |
| --- | --- | --- | --- |
| `0` | Success | Command succeeded, or a valid cache hit was returned. | Continue. |
| `1` | General failure | DNS block, timeout, invalid host, TLS error, or HTTP ≥ 400. | Check connectivity / URL / that the host is public. |
| `2` | Usage error | Invalid flags, missing arguments, or bad `--stdin` usage. | Re-check `--help`. |
| `5` | Offline stale warning | Remote unreachable; stale cache served from inside the grace window. | Content is usable but unverified. Pass `--allow-stale` to exit `0` instead. |

## A cache-first workflow

Agents get the most value by checking the cache before reaching for the network:

1. **Search** existing research first — it is the cheapest path:
   ```bash
   bonsai search "node url api" --json
   ```
2. **Plan** with `status` to see what a fetch *would* do, without doing it:
   ```bash
   bonsai status https://nodejs.org/api/url.html --json
   ```
3. **Fetch** only when needed; use `--dry-run` to validate extraction before
   committing it to the cache:
   ```bash
   bonsai https://nodejs.org/api/url.html --dry-run --json
   ```
4. **Synthesize** multi-source notes back into the cache with `import` and
   repeated `--source-url` flags so the synthesis stays source-cited:
   ```bash
   cat synthesis.md | bonsai import --stdin --topic "Auth" \
     --source-url https://a.example --source-url https://b.example --json
   ```

Because URLs are normalized and output is deterministic, the same request yields
the same cache key and the same bytes — repeatable across runs and machines.
