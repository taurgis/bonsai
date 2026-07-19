# OCLIF Flags — Complete Reference

## All Options (applicable to all flag types unless noted)

| Option | Type | Notes |
|--------|------|-------|
| `char` | single alpha char | Short alias: `-n` |
| `summary` | string | One-liner shown in help listing |
| `description` | string | Detailed help shown in `--help` |
| `required` | boolean | Error if flag is missing |
| `default` | `T \| async (ctx) => T` | Default value; can be async |
| `defaultHelp` | `T \| async (ctx) => T` | Display value for dynamic defaults |
| `env` | string | Fallback environment variable name |
| `hidden` | boolean | Hide from help output |
| `multiple` | boolean | Allow repeated usage → `T[]` |
| `multipleNonGreedy` | boolean | One value per flag instance only |
| `delimiter` | string | Split `a,b,c` into array with `multiple` |
| `helpValue` | string | Shown as `--flag=<helpValue>` |
| `aliases` | string[] | Alternative long names |
| `charAliases` | string[] | Alternative single-char aliases |
| `deprecateAliases` | boolean | Warn when alias is used |
| `deprecated` | boolean \| object | Mark flag deprecated |
| `dependsOn` | string[] | These flags must also be set |
| `exclusive` | string[] | Cannot be combined with these flags |
| `exactlyOne` | string[] | Exactly one of these must be set |
| `atLeastOne` | string[] | At least one of these must be set |
| `noCacheDefault` | boolean | Prevent storing default in manifest |
| `helpGroup` | string | Group label in help output |
| `helpLabel` | string | Custom display label in help |
| `parse` | `async (input, ctx, opts) => T` | Custom value transformation |
| `allowStdin` | boolean \| 'only' | Accept `-` to read from stdin |
| `options` | string[] | Restrict to discrete string values |

## Relationship Constraints

### Simple (on any flag)

```typescript
output: Flags.string({
  dependsOn: ['format'],        // --format must also be set
  exclusive: ['no-output'],     // cannot combine with --no-output
  exactlyOne: ['output','file'],// exactly one of this list must be set
  atLeastOne: ['a','b'],        // at least one of this list must be set
})
```

### Complex (using `relationships` array)

```typescript
verbose: Flags.boolean({
  relationships: [
    {type: 'none',  flags: ['quiet']},
    {type: 'all',   flags: ['log-file']},            // all must be set
    {type: 'some',  flags: ['debug', 'trace']},      // at least one must be set
    {type: 'none',  flags: [{
      name: 'silent',
      when: async (flags) => flags.silent === true,  // conditional
    }]},
  ],
})
```

## Type-Specific Notes

### `Flags.boolean()`

- `allowNo: true` enables `--no-<flag>` to set value to `false`
- Cannot have `multiple`, `helpValue`, `parse`, `allowStdin`, or `options`

### `Flags.integer()`

- `min` and `max` options for validation
- Validates `^-?\d+$` and calls `Number.parseInt()`

### `Flags.option()` — factory pattern

```typescript
// Must use double invocation:
myFlag: Flags.option({
  options: ['a','b','c'] as const,  // `as const` required for union type
})(),   // ← outer () creates factory, inner () creates flag definition

// Customize per-use:
static flags = {
  env: envFlag({required: true}),   // from a shared factory
}
```

### `Flags.url()`

- Returns a `URL` object, not a string
- Throws `CLIError` on invalid URL

### `Flags.file()` and `Flags.directory()`

- `exists: true` validates the path exists at parse time

### `Flags.custom<T, P>()`

```typescript
const teamFlag = Flags.custom<Team, {validate?: boolean}>({
  parse: async (input, ctx, opts) => {
    // opts comes from per-use options e.g. teamFlag({validate: true})
    return await fetchTeam(input)
  },
})

// Usage:
team: teamFlag()           // default options
team: teamFlag({required: true})  // override per-use
```

## `noCacheDefault` — When to Use

When a flag's default reads from runtime state (tokens, env vars, user config), set `noCacheDefault: true` to prevent the value from being baked into `oclif.manifest.json`:

```typescript
token: Flags.string({
  noCacheDefault: true,
  default: async () => readTokenFromKeychain(),
})
```
