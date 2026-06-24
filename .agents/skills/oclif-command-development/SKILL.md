---
name: oclif-command-development
description: 'Build OCLIF v4 commands with flags, args, JSON output, and error handling. Use when writing or reviewing a command class in an OCLIF CLI, defining typed flags and positional args, implementing --json output, or handling errors and exit codes.'
metadata:
  version: '1.0.0'
  category: CLI Development
  tags:
    - oclif
    - cli
    - node
    - typescript
    - command
---

# OCLIF Command Development

Practical guidance for writing OCLIF v4 command classes with correctly typed flags, args, JSON output, and error handling. Covers `@oclif/core` v4.x targeting Node.js 18+.

## When to Use This Skill

- Writing a new OCLIF command class from scratch
- Adding flags, args, or enabling `--json` output to an existing command
- Implementing error handling and exit codes
- Creating a shared base command for a multi-command CLI
- **Not for:** Project scaffolding, plugin setup, or UX/output formatting — see related skills below

## Prerequisites

- `@oclif/core` v4.x installed
- Node.js 18+
- TypeScript configured (recommended)

## Quick Start

```typescript
import {Args, Command, Flags} from '@oclif/core'

export default class Deploy extends Command {
  static summary = 'Deploy an application'
  static description = 'Deploy the application to a target environment.'
  static enableJsonFlag = true
  static examples = [
    '<%= config.bin %> <%= command.id %> myapp --env=prod',
  ]

  static flags = {
    env: Flags.option({
      char: 'e',
      options: ['dev', 'staging', 'prod'] as const,
      required: true,
      summary: 'Target environment',
    })(),
    dry: Flags.boolean({char: 'd', default: false, summary: 'Dry run'}),
  }

  static args = {
    app: Args.string({required: true, description: 'App name'}),
  }

  async run(): Promise<{app: string; env: string}> {
    const {args, flags} = await this.parse(Deploy)
    this.log(`Deploying ${args.app} to ${flags.env}`)
    return {app: args.app, env: flags.env}
  }
}
```

## Flags

### Built-in flag types

| Type | Usage | Returns |
|------|-------|---------|
| `Flags.string()` | Free-form text | `string` |
| `Flags.boolean()` | On/off switch | `boolean` |
| `Flags.integer()` | Whole number | `number` |
| `Flags.option()()` | Constrained enum | inferred union |
| `Flags.url()` | Validated URL | `URL` |
| `Flags.file()` | File path | `string` |
| `Flags.directory()` | Dir path | `string` |
| `Flags.custom<T>()()` | Any type | `T` |

### Common flag options

```typescript
Flags.string({
  char: 'n',            // short alias: -n
  summary: 'One liner', // shown in help listing
  description: 'Long.', // shown in --help detail
  required: true,
  default: 'world',
  env: 'MY_VAR',        // fallback to env var
  multiple: true,        // allow --flag a --flag b → string[]
  delimiter: ',',        // allow --flag a,b,c
  helpValue: '<name>',
  hidden: false,
  allowStdin: true,      // accept - to read from stdin
  options: ['a','b'],   // constrain to discrete values
  dependsOn: ['other'],  // requires --other to also be set
  exclusive: ['alt'],    // cannot combine with --alt
  noCacheDefault: true,  // don't store dynamic default in manifest
  helpGroup: 'ADVANCED', // group in help output
})
```

### `Flags.option()` — type-safe enum (preferred over `options:` on string)

```typescript
static flags = {
  format: Flags.option({
    options: ['json', 'csv', 'table'] as const, // `as const` required for union type
    default: 'table',
  })(),
}
// flags.format is typed as 'json' | 'csv' | 'table'
```

### `Flags.boolean()` with `allowNo`

```typescript
static flags = {
  color: Flags.boolean({allowNo: true, default: true}),
}
// --color enables, --no-color disables
```

### Custom reusable flag

```typescript
// flags/team.ts
import {Flags} from '@oclif/core'

export const teamFlag = Flags.custom<{id: string; name: string}>({
  parse: async (input) => {
    const team = await fetchTeam(input)
    if (!team) throw new Error(`Team "${input}" not found`)
    return team
  },
})

// in a command:
static flags = {
  team: teamFlag({required: true}),
}
```

## Args

Positional arguments — order matters. Defined as an object whose key insertion order determines position.

```typescript
static args = {
  source: Args.string({required: true, description: 'Source path'}),
  dest:   Args.string({required: false, default: './out'}),
}
```

### All arg types

`Args.string()`, `Args.integer()`, `Args.boolean()`, `Args.url()`, `Args.file({exists: true})`, `Args.directory()`, `Args.custom<T>()`

### Variadic args

Only one arg per command can have `multiple: true` and it must be last.

```typescript
static args = {
  first: Args.string({required: true}),
  rest:  Args.string({multiple: true}),
}
// args.rest is string[]
```

### Args vs Flags

| | Args | Flags |
|-|------|-------|
| Syntax | `cmd value` | `cmd --name value` |
| Position order | Required | No |
| Short alias | No | Yes (`char`) |
| `env` fallback | No | Yes |
| `dependsOn/exclusive` | No | Yes |

## JSON Output

```typescript
static enableJsonFlag = true

async run(): Promise<{id: string}> {
  this.log('Human output')     // suppressed when --json is active
  return {id: '123'}           // auto-serialized as JSON with --json
}

// Detect JSON mode for skipping spinners/prompts:
if (this.jsonEnabled()) { /* skip interactive output */ }

// Customize error JSON shape:
protected toErrorJson(err: unknown) {
  return {error: {message: (err as Error).message, code: (err as any).code}}
}
```

## Error Handling

```typescript
// Throw a formatted error and exit:
this.error('Something went wrong', {
  code: 'MY_ERROR',        // machine-readable code
  exit: 1,                 // exit code (default: 2)
  ref: 'https://docs.example.com/errors',
  suggestions: ['Try --verbose for details'],
})

// Exit cleanly:
this.exit(0)

// Override catch() in a command:
protected async catch(err: Error & {exitCode?: number}) {
  if (err.message.includes('ENOENT')) {
    this.error('File not found. Check your path.', {exit: 1})
  }
  return super.catch(err)
}
```

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | General error |
| `2` | `this.error()` default |
| `127` | Command not found |

## Command Lifecycle

```typescript
async init(): Promise<void> {
  await super.init()
  // Runs before run(); use for auth checks or base flag parsing
}

async run(): Promise<void> { /* main logic */ }

async catch(err: Error & {exitCode?: number}) {
  return super.catch(err)
}

async finally(err: Error | undefined) {
  await super.finally(err)
  // Always runs — cleanup here
}
```

## Shared Base Command

```typescript
// src/baseCommand.ts
import {Command, Flags, Interfaces} from '@oclif/core'

type FlagsType<T extends typeof Command> = Interfaces.InferredFlags<
  typeof BaseCommand['baseFlags'] & T['flags']
>
type ArgsType<T extends typeof Command> = Interfaces.InferredArgs<T['args']>

export abstract class BaseCommand<T extends typeof Command> extends Command {
  static enableJsonFlag = true

  static baseFlags = {
    'log-level': Flags.option({
      default: 'info' as const,
      options: ['debug', 'info', 'warn', 'error'] as const,
      helpGroup: 'GLOBAL',
    })(),
  }

  protected flags!: FlagsType<T>
  protected args!: ArgsType<T>

  public async init(): Promise<void> {
    await super.init()
    const {args, flags} = await this.parse({
      flags: this.ctor.flags,
      baseFlags: (super.ctor as typeof BaseCommand).baseFlags,
      enableJsonFlag: this.ctor.enableJsonFlag,
      args: this.ctor.args,
      strict: this.ctor.strict,
    })
    this.flags = flags as FlagsType<T>
    this.args = args as ArgsType<T>
  }
}
```

## Quick Reference

| Method | Description |
|--------|-------------|
| `this.log(msg)` | stdout (suppressed with --json) |
| `this.warn(msg)` | stderr warning |
| `this.error(msg, opts)` | throw CLIError and exit |
| `this.exit(code)` | exit cleanly |
| `this.jsonEnabled()` | true if --json active |
| `this.debug(msg)` | debug output (needs `DEBUG=<cli>:*`) |
| `this.parse(Cmd)` | parse flags and args |

## References

- [Flags reference](references/FLAGS.md) — all flag options and relationship constraints
- [Args reference](references/ARGS.md) — all arg types and variadic patterns
- [oclif.io commands docs](https://oclif.io/docs/commands/)
- [oclif.io flags docs](https://oclif.io/docs/flags/)
- [oclif.io error handling](https://oclif.io/docs/error_handling/)
