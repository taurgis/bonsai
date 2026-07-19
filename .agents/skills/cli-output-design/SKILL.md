---
name: cli-output-design
description: 'Design well-structured CLI output: stdout/stderr routing, tables, TTY detection, color, progress indicators, JSON mode, exit codes, shell completion, update notifications, and debug logging. Use when deciding how a CLI command should format and route its output, or when adding completion, update checks, or debug support to an OCLIF CLI.'
metadata:
  version: '1.0.0'
  category: CLI Development
  tags:
    - cli
    - output
    - ux
    - oclif
    - node
    - tty
    - completion
---

# CLI Output Design

Practical guidance for routing, formatting, and enriching CLI output. Covers the stdout/stderr split, output formats, TTY-aware behavior, progress indicators, and discoverability features like shell completion and update notifications.

Grounded in [clig.dev](https://clig.dev), the Heroku CLI Style Guide, and OCLIF documentation.

## When to Use This Skill

- Deciding what goes to stdout vs stderr
- Choosing between table, list, key-value, or JSON output
- Gating color and spinners on TTY state
- Adding shell completion or update notifications to an OCLIF CLI
- Setting up debug logging with the `DEBUG` env var
- **Not for:** Command design, flags, or error message copy — see [cli-design-principles](../cli-design-principles/SKILL.md)

---

## The Fundamental Rule: stdout is Data, stderr is Messages

```
stdout ← primary output, machine-readable data, JSON, piped content
stderr ← progress, status lines, warnings, errors, debug logs
```

This is what makes `mycli export --json 2>/dev/null | jq '.items[]'` work correctly. If a spinner writes to stdout, `jq` crashes on the animation frames.

In OCLIF:
- `this.log(msg)` → stdout (suppressed in `--json` mode)
- `this.logToStderr(msg)` → stderr
- `this.warn(msg)` → stderr
- `this.error(msg)` → stderr + exits
- `ux.action.start()` (spinner) → **stderr** by default

Check TTY state independently per stream:
```typescript
const colorOnStdout = process.stdout.isTTY === true
const colorOnStderr = process.stderr.isTTY === true  // for errors/warnings
const isInteractive  = process.stdin.isTTY === true  // for prompts
```

---

## Output Format Chooser

| Situation | Format |
|-----------|--------|
| Single entity with multiple attributes | Key-value pairs |
| List of entities with multiple attributes | Table |
| Homogeneous flat list (names, IDs) | Plain list, one per line |
| Hierarchical / nested data | Tree |
| Machine consumption or scripting | `--json` |
| Any of the above in CI/pipe | `--json` or plain text |

### Key-Value (single entity)

```
Name:     my-app
Region:   us-east-1
Status:   running
Created:  2025-01-15
```

Use for `describe`, `inspect`, `show` commands. Align colons vertically.

### Tables (multiple entities)

Design for `grep` compatibility — one entity per row, no decorative multi-row sections:

```
Name       Region     Status
─────────  ─────────  ────────
api        us-east-1  running
worker     us-east-1  stopped
```

Support these standard table flags:
```
--no-headers      omit header row (for scripting)
--no-truncate     show full values
--columns a,b,c   select specific columns
--sort col        sort by column
--csv             comma-separated output
--json            structured JSON output
```

### Plain list (homogeneous)

```
api
worker
scheduler
```

One item per line — fully compatible with `grep`, `wc -l`, `sort`.

### JSON output

Enable with `static enableJsonFlag = true` in OCLIF. Return structured data from `run()`:

```typescript
static enableJsonFlag = true

async run(): Promise<{items: Item[]}> {
  const items = await fetchItems()
  this.log(`Found ${items.length} items`)  // suppressed in --json mode
  return {items}                            // auto-serialized
}
```

JSON rules:
- Valid, complete JSON to stdout
- No ANSI color codes in JSON output
- Stable schema — treat it like an API contract
- For streaming/large lists, consider `--json-lines` (NDJSON): one object per line

---

## TTY Detection and Color

### Full color-off checklist

Disable color when **any** of these are true:

| Condition | Check |
|-----------|-------|
| `stdout`/`stderr` is not a TTY | `process.stdout.isTTY !== true` |
| `NO_COLOR` env var is set | `process.env.NO_COLOR !== undefined` |
| `TERM=dumb` | `process.env.TERM === 'dumb'` |
| `--no-color` flag | user flag |
| App-specific env var | `process.env.MYCLI_NO_COLOR` |

`chalk` and OCLIF's `ux.colorize()` handle most of this automatically. Force-enable with `FORCE_COLOR=1` (useful for CI that supports ANSI).

### Color semantics

| Color | Use for |
|-------|---------|
| Red | Errors, failures |
| Yellow | Warnings |
| Green | Success confirmation |
| Cyan | Secondary info, resource names |
| Dim/gray | Less important metadata |

Use color to reinforce meaning — never as the only indicator (colorblind users).

---

## Progress Indicators

### Spinner: unknown duration, single task

```typescript
import {ux} from '@oclif/core'

// Guard on TTY — ux.action handles this automatically in non-TTY
if (!this.jsonEnabled()) {
  ux.action.start('Deploying')
}
await deploy()
if (!this.jsonEnabled()) {
  ux.action.stop()       // prints "Deploying... done"
  // or:
  ux.action.stop('failed')
}
```

Update status mid-spin: `ux.action.status = 'Uploading bundle...'`

Pause safely to write output without corrupting the spinner:
```typescript
await ux.action.pauseAsync(async () => {
  this.log('Intermediate result')
})
```

### Progress bar: known total steps

Use `cli-progress` (`npm install cli-progress`):

```typescript
import {SingleBar, Presets} from 'cli-progress'

if (!this.jsonEnabled() && process.stderr.isTTY) {
  const bar = new SingleBar(
    {format: '{bar} {percentage}% | {value}/{total} files'},
    Presets.shades_classic,
  )
  bar.start(total, 0)
  for (const file of files) {
    await uploadFile(file)
    bar.increment()
  }
  bar.stop()
}
```

### Multi-step tasks

Use `listr2` (`npm install listr2`):

```typescript
import {Listr} from 'listr2'

const tasks = new Listr([
  {title: 'Build',  task: () => build()},
  {title: 'Test',   task: () => test()},
  {title: 'Deploy', task: () => deploy()},
], {
  renderer: this.jsonEnabled() ? 'silent' : 'default',
})

await tasks.run()
```

### When to use what

| Scenario | Indicator |
|----------|-----------|
| < 1 second | Nothing |
| 1–4 s, unknown duration | Spinner (`ux.action`) |
| > 4 s, known total | Progress bar |
| Multiple parallel/sequential named steps | `listr2` task list |

**On failure:** always reveal logs hidden behind a cleared progress bar. Don't lose context.

---

## Shell Completion with `@oclif/plugin-autocomplete`

```bash
npm install @oclif/plugin-autocomplete
```

```json
{"oclif": {"plugins": ["@oclif/plugin-autocomplete"]}}
```

This adds the `autocomplete` command to your CLI:

```bash
mycli autocomplete         # shows setup instructions
mycli autocomplete bash    # prints bash completion script
mycli autocomplete zsh     # prints zsh completion script
mycli autocomplete --refresh-cache  # rebuild cached completions
```

### User setup (document this prominently)

```bash
# Bash (~/.bashrc)
eval "$(mycli autocomplete bash)"

# Zsh (~/.zshrc)
eval "$(mycli autocomplete zsh)"

# Fish
mycli autocomplete fish > ~/.config/fish/completions/mycli.fish
```

### Dynamic flag value completions

Add a `complete` function to a flag to suggest values from the API:

```typescript
static flags = {
  app: Flags.string({
    async complete(): Promise<string[]> {
      return fetchAppNames()  // network call — cache aggressively
    },
  }),
}
```

The plugin caches completion data in `cacheDir`. Users rebuild with `--refresh-cache`.

---

## Update Notifications

### Option A: `update-notifier` (for npm-installed CLIs)

```bash
npm install update-notifier
```

```typescript
// In your CLI entry point or a prerun hook
import updateNotifier from 'update-notifier'
import {createRequire} from 'node:module'

const pkg = createRequire(import.meta.url)('../../package.json')
updateNotifier({pkg}).notify()
```

- Never blocks startup — check runs in a background subprocess
- Checks once per day by default
- Skips in CI (`CI=true`) and test environments
- User opt-out: `NO_UPDATE_NOTIFIER=1`

### Option B: `@oclif/plugin-update` (for standalone/packaged CLIs)

```json
{
  "oclif": {
    "plugins": ["@oclif/plugin-update"],
    "update": {"autoupdate": {"debounce": 7}}
  }
}
```

Adds:
```bash
mycli update               # update to latest
mycli update --available   # list available versions
mycli update --version 1.2.0  # pin to specific version
```

Use `@oclif/plugin-update` when your CLI is distributed as a standalone package (Homebrew, direct download). Use `update-notifier` when users install via `npm install -g`.

---

## Debug Logging with the `debug` Package

```bash
npm install debug
```

```typescript
import debug from 'debug'

const log = debug('mycli')
const logHttp = debug('mycli:http')
const logAuth = debug('mycli:auth')

log('starting %s', version)
logHttp('GET %s → %d', url, status)
```

Activated via env var (zero output by default):

```bash
DEBUG=mycli:*   mycli deploy   # all mycli namespaces
DEBUG=mycli:http mycli deploy  # HTTP only
DEBUG=*          mycli deploy  # everything (very noisy)
```

Key behaviors:
- Goes to **stderr** by default — does not pollute stdout
- Shows millisecond timestamps between calls (useful for perf bottlenecks)
- Color-coded by namespace in TTY
- Zero overhead when not active

### OCLIF's built-in `this.debug()`

```typescript
this.debug('parsing flags: %O', flags)
```

Namespace is automatically `<cli-bin>:<command-id>`. Enable with `DEBUG=mycli:deploy`.

In v4, all OCLIF internal namespaces require the `oclif:` prefix:
```bash
DEBUG=oclif:*      # internal OCLIF debug output
DEBUG=oclif:perf   # performance timing
```

---

## OCLIF Config Directories

Access from any command or hook via `this.config`:

```typescript
this.config.configDir   // ~/.config/mycli  (user prefs, credentials)
this.config.dataDir     // ~/.local/share/mycli  (plugin data)
this.config.cacheDir    // ~/.cache/mycli  (completions, api response cache)
```

Write user preferences to `configDir`. Cache API responses and completion data to `cacheDir`. Store plugin state to `dataDir`. Never write to the CLI's install directory.

---

## References

- [Output formats and table patterns](references/OUTPUT-FORMATS.md)
- [clig.dev — Command Line Interface Guidelines](https://clig.dev)
- [Heroku CLI Style Guide](https://devcenter.heroku.com/articles/cli-style-guide)
- [@oclif/plugin-autocomplete](https://github.com/oclif/plugin-autocomplete)
- [@oclif/plugin-update](https://github.com/oclif/plugin-update)
- [debug npm package](https://github.com/debug-js/debug)
- [cli-progress](https://github.com/npkgjs/cli-progress)
- [listr2](https://listr2.kilic.dev/)
