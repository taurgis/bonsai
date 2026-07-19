# CLI Error Handling and Confirmation Patterns

## Exit Codes

### Core set (use these by default)

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | General / unknown error |
| `2` | Usage / invocation error (bad flags, missing args) |
| `130` | Ctrl+C termination (128 + SIGINT) |

### Extended set (use for richer scripting)

| Code | Meaning |
|------|---------|
| `3` | Resource not found |
| `4` | Unauthorized / forbidden |
| `5` | Conflict / precondition failed |

### `sysexits.h` constants (for Unix convention alignment)

| Code | Constant | Meaning |
|------|----------|---------|
| `64` | `EX_USAGE` | Command-line usage error |
| `65` | `EX_DATAERR` | Invalid input data |
| `66` | `EX_NOINPUT` | Input file not found |
| `69` | `EX_UNAVAILABLE` | Required service unavailable |
| `70` | `EX_SOFTWARE` | Internal software error |
| `77` | `EX_NOPERM` | Permission denied |
| `78` | `EX_CONFIG` | Configuration error |

### OCLIF exit code usage

```typescript
// this.error() default is exit code 2
this.error('Bad usage.', {exit: 2})

// Use sysexits for semantic precision
this.error('Config file is invalid.', {exit: 78, code: 'EX_CONFIG'})

// Exit cleanly
this.exit(0)
```

Document all non-zero exit codes your CLI produces in the `--help` output or README.

---

## Error Message Templates

### Missing required input

```
Error: No app specified.
  Run: mycli deploy --app <name>
  Learn more: https://docs.example.com/deploy
```

### Invalid flag value

```
Error: Invalid environment "preproduction". Expected one of: dev, staging, prod.
  Run: mycli deploy --env staging
```

### Permission denied

```
Error: Can't write to /etc/mycli/config.
  You may need to run with sudo, or choose a different --config path.
```

### Network / service unavailable

```
Error: Could not reach api.example.com. Check your internet connection.
  If you're behind a proxy, set HTTPS_PROXY=http://your-proxy:8080.
```

### Unexpected internal error

```
Error: Unexpected failure in deploy command. (code: E4002)
  Run with --debug for full details.
  Report this at: https://github.com/org/mycli/issues/new?body=version%3A1.2.3
```

---

## Confirmation Patterns by Risk Level

### Low risk — optional, or skip entirely

```typescript
// Skip for fully reversible, local-only operations
```

### Moderate risk — require --force in scripts

```typescript
import {confirm} from '@inquirer/prompts'

if (!this.jsonEnabled() && process.stdin.isTTY) {
  const ok = await confirm({
    message: `Delete ${flags.resource}?`,
    default: false,  // default to the safe choice
  })
  if (!ok) this.exit(0)
} else if (!flags.force) {
  this.error(`--force required to delete ${flags.resource} non-interactively.`, {exit: 2})
}
```

### High risk — type-to-confirm

```typescript
import {input} from '@inquirer/prompts'

if (!this.jsonEnabled() && process.stdin.isTTY) {
  const confirmation = await input({
    message: `Type "${flags.app}" to confirm permanent deletion:`,
  })
  if (confirmation !== flags.app) {
    this.error('Confirmation did not match. Aborting.', {exit: 1})
  }
} else if (flags.confirm !== flags.app) {
  this.error(
    `--confirm="${flags.app}" required to delete this app non-interactively.`,
    {exit: 2}
  )
}
```

---

## Handling Ctrl+C

Exit cleanly with code 130 on SIGINT. OCLIF handles this by default. To clean up before exit:

```typescript
async finally(err: Error | undefined) {
  await super.finally(err)
  // cleanup: close file handles, remove temp files, etc.
}
```

If a spinner or progress bar is running, ensure it stops on Ctrl+C so the terminal is left clean.

---

## Error Formatting in --json Mode

When `--json` is active, errors should also be machine-readable:

```typescript
protected toErrorJson(err: unknown) {
  const e = err as Error & {oclif?: {code?: string; exit?: number}}
  return {
    error: {
      message: e.message,
      code: e.oclif?.code,
      exit: e.oclif?.exit,
    }
  }
}
```
