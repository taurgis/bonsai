# OCLIF Hooks — Reference

## Hook Event Payloads

### `init`

```typescript
import {Hook} from '@oclif/core'

const hook: Hook.Init = async function (options) {
  options.id      // string | undefined — command ID being run
  options.argv    // string[] — raw process argv
  options.config  // Config — full CLI config
}
```

### `prerun`

```typescript
const hook: Hook.Prerun = async function (options) {
  options.Command // typeof Command — the command class about to run
  options.argv    // string[]
  options.config  // Config
}
```

### `postrun`

```typescript
const hook: Hook.Postrun = async function (options) {
  options.Command // typeof Command
  options.result  // unknown — return value from run()
  options.argv    // string[]
  options.config  // Config
}
```

### `command_not_found`

```typescript
const hook: Hook.CommandNotFound = async function (options) {
  options.id      // string — the attempted command ID
  options.argv    // string[]
  options.config  // Config
}
// Use to suggest similar commands or run a fallback
```

### `jit_plugin_not_installed`

```typescript
const hook: Hook.JitPluginNotInstalled = async function (options) {
  options.id          // string — command ID that triggered the JIT install
  options.argv        // string[]
  options.config      // Config
  options.pluginName  // string — npm package to install
  options.version     // string — version range from jitPlugins config
}
// Prompt the user to install and then run the command
```

## Hook Error Handling

Hook errors do not cause the CLI to exit unless the hook explicitly calls:

```typescript
options.context.error('message', {exit: 1})
// or
options.context.exit(1)
```

A thrown uncaught error in a hook is logged but does not stop the command from running.

## Custom Events

```typescript
// Define a custom event type
declare module '@oclif/core/interfaces' {
  interface Hooks {
    'my-event': {
      return: void
      options: {data: string}
    }
  }
}

// Emit from command:
await this.config.runHook('my-event', {data: 'value'})

// Register in package.json:
// "oclif": { "hooks": { "my-event": "./dist/hooks/my-event" } }
```

## Common Hook Patterns

### Auth check in `prerun`

```typescript
const hook: Hook.Prerun = async function ({Command, config}) {
  const requiresAuth = (Command as any).requiresAuth ?? true
  if (requiresAuth) {
    const token = await readToken(config.configDir)
    if (!token) {
      this.error('Not authenticated. Run: mycli login', {exit: 1})
    }
  }
}
```

### Analytics in `postrun`

```typescript
const hook: Hook.Postrun = async function ({Command, argv, config}) {
  // Fire and forget — don't block the CLI exit
  trackEvent(Command.id, argv).catch(() => {})
}
```

### Fuzzy match in `command_not_found`

```typescript
const hook: Hook.CommandNotFound = async function ({id, config}) {
  const commands = config.getPluginsList()
    .flatMap(p => p.commands)
    .map(c => c.id)
  const match = closestMatch(id, commands)
  if (match) {
    this.warn(`Command "${id}" not found. Did you mean "${match}"?`)
  }
}
```
