---
name: oclif-ux-and-output
description: 'Format CLI output, add spinners, tables, prompts, and color in OCLIF v4. Use when adding user-facing output formatting, progress indicators, interactive prompts, or theming to an OCLIF command.'
metadata:
  version: '1.0.0'
  category: CLI Development
  tags:
    - oclif
    - cli
    - ux
    - output
    - spinner
    - prompts
    - color
---

# OCLIF UX and Output

Practical guidance for CLI output in OCLIF v4: spinners, tables, prompts, color, JSON-safe patterns, and theming. Includes what was removed in v4 and their recommended replacements.

## When to Use This Skill

- Adding a spinner or progress bar to a long-running command
- Formatting tabular output from a list command
- Adding interactive prompts (confirm, select, text input)
- Applying color while respecting `--no-color` / `NO_COLOR`
- Configuring a CLI theme
- Making output safe with `--json` mode
- **Not for:** Command flag/arg definitions — see [oclif-command-development](../oclif-command-development/SKILL.md)

## What Survived in the v4 `ux` Module

`@oclif/core` v4 removed most UX utilities from `cli-ux`. Only these remain built-in:

| Built-in | Purpose |
|---------|---------|
| `ux.action` | Spinner / animated status indicator |
| `ux.colorize(color, text)` | Hex, RGB, or named ANSI color |
| `ux.colorizeJson(obj, opts)` | Syntax-colored JSON output |
| `ux.stdout(msg)` | Write to stdout (same as `this.log`) |
| `ux.stderr(msg)` | Write to stderr |
| `ux.warn(msg)` | Print warning |
| `ux.error(msg, opts)` | Throw CLIError |

Everything else requires a third-party package (see replacements below).

## Spinner (`ux.action`)

Auto-detects TTY. In non-TTY environments (CI, pipes) it degrades gracefully.

```typescript
import {ux} from '@oclif/core'

ux.action.start('Fetching data')
// update status mid-spin:
ux.action.status = 'Loading page 2...'
await doWork()
ux.action.stop()           // prints "Fetching data... done"
ux.action.stop('failed')   // prints "Fetching data... failed"

// Check if running:
if (ux.action.running) { /* ... */ }

// Pause to safely write output without corrupting the spinner:
await ux.action.pauseAsync(async () => {
  this.log('Intermediate result')
})

// Options:
ux.action.start('Working', 'please wait', {
  stdout: false,   // default: stderr. true = stdout
  style: 'dots2',  // spinner style
})
```

### JSON-safe spinner pattern

Always guard spinners with `jsonEnabled()`:

```typescript
async run() {
  if (!this.jsonEnabled()) {
    ux.action.start('Processing')
  }
  const result = await doWork()
  if (!this.jsonEnabled()) {
    ux.action.stop()
  }
  return result
}
```

## Color

```typescript
import {ux} from '@oclif/core'

// Accepts hex, rgb(), or chalk ANSI name
this.log(ux.colorize('#0070D2', 'Info'))
this.log(ux.colorize('red', 'Error'))
this.log(ux.colorize('rgb(0,200,100)', 'Success'))

// Syntax-colored JSON
this.log(ux.colorizeJson({status: 'ok', count: 42}, {
  theme: {
    key:     '#16325C',
    string:  '#2E844A',
    number:  '#0070D2',
    boolean: '#BA0517',
    null:    '#3E3E3C',
  }
}))
```

### Color detection — env vars

| Env var | Effect |
|---------|--------|
| `NO_COLOR` (any value) | Disable all colors (standard) |
| `FORCE_COLOR=1` | Force basic 16 colors |
| `FORCE_COLOR=2` | Force 256-color |
| `FORCE_COLOR=3` | Force truecolor |

## Replacements for Removed `ux` Features

### Interactive prompts → `@inquirer/prompts`

```bash
npm install @inquirer/prompts
```

```typescript
import {input, confirm, password, select, checkbox} from '@inquirer/prompts'

// Text input
const name = await input({message: 'Enter your name:'})

// Confirm
const ok = await confirm({message: 'Continue?', default: true})

// Password (hidden)
const token = await password({message: 'API token:'})

// Single select
const env = await select({
  message: 'Choose environment:',
  choices: [{value: 'dev'}, {value: 'staging'}, {value: 'prod'}],
})

// Multi-select
const features = await checkbox({
  message: 'Select features:',
  choices: [{value: 'auth'}, {value: 'api'}, {value: 'ui'}],
})

// Always guard with jsonEnabled():
const confirmed = this.jsonEnabled()
  ? true
  : await confirm({message: 'Deploy now?'})
```

### Tables → `cli-table3`

```bash
npm install cli-table3 && npm install --save-dev @types/cli-table3
```

```typescript
import Table from 'cli-table3'

const table = new Table({
  head: ['Name', 'Version', 'Status'],
  colWidths: [20, 10, 10],
  style: {head: ['cyan']},
})

for (const plugin of plugins) {
  table.push([plugin.name, plugin.version, plugin.status])
}

this.log(table.toString())
```

For JSON-safe output, guard the table with `jsonEnabled()` and always return structured data.

### Progress bar → `cli-progress`

```bash
npm install cli-progress && npm install --save-dev @types/cli-progress
```

```typescript
import {SingleBar, Presets} from 'cli-progress'

if (!this.jsonEnabled()) {
  const bar = new SingleBar(
    {format: '{bar} {percentage}% | ETA: {eta}s | {value}/{total}'},
    Presets.shades_classic
  )
  bar.start(total, 0)
  for (const item of items) {
    await processItem(item)
    bar.increment()
  }
  bar.stop()
} else {
  for (const item of items) await processItem(item)
}
```

### Multi-step tasks → `listr2`

```bash
npm install listr2
```

```typescript
import {Listr} from 'listr2'

async run() {
  const results: Record<string, unknown> = {}

  const tasks = new Listr([
    {
      title: 'Authenticate',
      task: async (ctx) => {
        ctx.token = await authenticate()
      },
    },
    {
      title: 'Deploy',
      task: async (ctx, task) => {
        task.output = 'Uploading...'
        results.deployId = await deploy(ctx.token)
      },
      options: {persistentOutput: true},
    },
  ], {
    renderer: this.jsonEnabled() ? 'silent' : 'default',
  })

  await tasks.run()
  return results
}
```

## Theming

Create `theme.json` in your project root:

```json
{
  "bin":              "#0070D2",
  "command":          "#16325C",
  "commandSummary":   "#3E3E3C",
  "flag":             "#16325C",
  "flagRequired":     "#BA0517",
  "flagDefaultValue": "#3E3E3C",
  "sectionHeader":    "#0070D2",
  "topic":            "#16325C",
  "version":          "#3E3E3C",
  "jsonKey":          "#16325C",
  "jsonString":       "#2E844A",
  "jsonNumber":       "#0070D2",
  "jsonBoolean":      "#BA0517",
  "jsonNull":         "#3E3E3C"
}
```

Register in `package.json`:

```json
{
  "oclif": {"theme": "theme.json"},
  "files": ["/theme.json"]
}
```

Users can override by placing `theme.json` in `~/.config/<cli-bin>/`. Disable entirely: `<CLI_BIN>_DISABLE_THEME=1`.

Access theme colors in commands:

```typescript
this.log(ux.colorize(this.config.theme?.bin, this.config.bin))
```

## Quick Reference

| Need | Solution |
|------|---------|
| Spinner | `ux.action.start()` / `.stop()` (built-in) |
| Color text | `ux.colorize(color, text)` (built-in) |
| Colored JSON | `ux.colorizeJson(obj, {theme})` (built-in) |
| Confirm prompt | `@inquirer/prompts` → `confirm()` |
| Text input | `@inquirer/prompts` → `input()` |
| Select | `@inquirer/prompts` → `select()` |
| Table | `cli-table3` |
| Progress bar | `cli-progress` |
| Multi-step tasks | `listr2` |

## References

- [oclif.io user experience docs](https://oclif.io/docs/user_experience/)
- [oclif.io themes docs](https://oclif.io/docs/themes/)
- [@inquirer/prompts docs](https://github.com/SBoudrias/Inquirer.js/tree/main/packages/prompts)
- [cli-table3 README](https://github.com/cli-table/cli-table3)
- [listr2 docs](https://listr2.kilic.dev/)
