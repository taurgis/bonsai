---
name: oclif-project-setup
description: 'Scaffold, configure, and structure OCLIF v4 CLI projects and plugins. Use when initializing a new CLI, configuring package.json oclif settings, organizing multi-command topics, registering plugins, or setting up hooks.'
metadata:
  version: '1.0.0'
  category: CLI Development
  tags:
    - oclif
    - cli
    - node
    - typescript
    - plugins
    - hooks
---

# OCLIF Project Setup

Covers scaffolding, `package.json` configuration, multi-command organization, plugins, and hooks for OCLIF v4 CLIs and plugins.

## When to Use This Skill

- Initializing a new CLI project or plugin with `oclif generate`
- Configuring `package.json#oclif` for command discovery, plugins, and topics
- Structuring commands into topics (namespaced subcommands)
- Adding user-installable plugins via `@oclif/plugin-plugins`
- Registering and writing hooks (init, prerun, postrun, command_not_found)
- **Not for:** Writing command logic — see [oclif-command-development](../oclif-command-development/SKILL.md)

## Prerequisites

- Node.js 18+
- `npm` or `yarn`

## Scaffolding

```bash
# New CLI or plugin project
npx oclif generate mynewcli

# Add OCLIF to an existing package
npx oclif init

# Generate a new command file
npx oclif generate command hello:world

# Generate a hook
npx oclif generate hook analytics --event init
```

## Project Structure

```
my-cli/
├── bin/
│   ├── dev.js           # Development runner (ts-node / tsx)
│   └── run.js           # Production runner
├── src/
│   ├── commands/
│   │   ├── hello.ts          # → "mycli hello"
│   │   └── apps/
│   │       ├── list.ts       # → "mycli apps list"
│   │       └── create.ts     # → "mycli apps create"
│   ├── hooks/
│   │   └── init/
│   │       └── analytics.ts
│   └── baseCommand.ts
├── test/
├── oclif.manifest.json   # Pre-generated; shipped in npm package
└── package.json
```

### bin/run.js

```js
#!/usr/bin/env node
(async () => {
  const oclif = await import('@oclif/core')
  await oclif.execute({development: false, dir: __dirname})
})()
```

### bin/dev.js

```js
#!/usr/bin/env node_modules/.bin/ts-node
;(async () => {
  const oclif = await import('@oclif/core')
  await oclif.execute({development: true, dir: __dirname})
})()
```

## package.json — `oclif` Key

```json
{
  "bin": {"mycli": "./bin/run.js"},
  "files": ["/bin", "/dist", "/oclif.manifest.json"],
  "oclif": {
    "bin": "mycli",
    "dirname": "mycli",
    "commands": "./dist/commands",
    "topicSeparator": " ",
    "plugins": [
      "@oclif/plugin-help",
      "@oclif/plugin-not-found",
      "@oclif/plugin-plugins"
    ],
    "hooks": {
      "init":    "./dist/hooks/init/analytics",
      "prerun":  "./dist/hooks/prerun/auth",
      "postrun": "./dist/hooks/postrun/track"
    },
    "topics": {
      "apps": {"description": "Manage applications"},
      "config": {"description": "Manage configuration"}
    },
    "helpOptions": {
      "hideCommandSummaryInDescription": false,
      "maxWidth": 120,
      "sections": ["description","usage","arguments","flags","examples","commands"]
    }
  },
  "scripts": {
    "build":   "shx rm -rf dist && tsc -b",
    "prepack": "oclif manifest && oclif readme",
    "postpack": "shx rm -f oclif.manifest.json",
    "version": "oclif readme && git add README.md"
  }
}
```

### Key `oclif` settings

| Key | Description |
|-----|-------------|
| `bin` | CLI binary name (e.g. `sf`, `heroku`) |
| `dirname` | Name for config/cache dirs (`~/.config/<dirname>`) |
| `commands` | Path to compiled commands dir |
| `topicSeparator` | `":"` or `" "` between topic and command |
| `plugins` | Array of npm packages or minimatch patterns |
| `devPlugins` | Plugins loaded only in development |
| `jitPlugins` | Just-in-time plugins: `{"pkg": "^1.0.0"}` |
| `hooks` | Event → file path (or array for multiple hooks) |
| `topics` | Topic name → `{description, hidden}` |
| `state` | `"beta"` — shown in help |
| `theme` | Path to `theme.json` |
| `helpClass` | Path to custom help class |
| `scope` | npm org name for user-installable plugin resolution |
| `flexibleTaxonomy` | Allow partial command matching |
| `binAliases` | Additional bin names for the CLI |

## Topics — Multi-Command Organization

Commands are discovered from directory structure. A file at `src/commands/apps/list.ts` automatically creates the `apps list` topic+command pair.

```json
{
  "oclif": {
    "topicSeparator": " ",
    "topics": {
      "apps": {
        "description": "Manage Heroku apps",
        "hidden": false
      },
      "apps:addons": {
        "description": "Manage add-ons for an app"
      }
    }
  }
}
```

Keep topics 1–2 levels deep for good UX. Deeper nesting makes help hard to navigate.

## Manifest Generation

`oclif.manifest.json` pre-indexes all commands so OCLIF skips filesystem discovery at startup — critical for CLIs with many commands.

```bash
# Generate (run before publishing)
npx oclif manifest

# With JIT plugin commands included
npx oclif manifest --jit
```

Always include `oclif.manifest.json` in `package.json#files` and generate it in `prepack`. The `postpack` script deletes it locally to prevent stale data during development.

## Hooks

### Built-in hook events

| Event | Fires when |
|-------|-----------|
| `init` | CLI initializes, before command is found |
| `prerun` | Before `run()` executes |
| `postrun` | After `run()` completes successfully |
| `command_not_found` | Command ID not found |
| `jit_plugin_not_installed` | JIT plugin command invoked before install |

### Writing a hook

```typescript
// src/hooks/init/analytics.ts
import {Hook} from '@oclif/core'

const hook: Hook.Init = async function (options) {
  // options.id     — command being invoked
  // options.config — Config instance
  // options.argv   — raw argv
  console.log(`Running: ${options.id}`)
}

export default hook
```

### Multiple hooks per event

```json
{
  "oclif": {
    "prerun": [
      "./dist/hooks/prerun/auth",
      "./dist/hooks/prerun/rate-limit"
    ]
  }
}
```

Hooks for the same event run sequentially in the order listed.

### Custom hook events

```typescript
// Emit from a command
await this.config.runHook('my-event', {data: 'payload'})

// Register in package.json
"oclif": {
  "hooks": {
    "my-event": "./dist/hooks/my-event"
  }
}
```

## User-Installable Plugins

Install `@oclif/plugin-plugins` to let users extend your CLI:

```json
{
  "dependencies": {"@oclif/plugin-plugins": "^5"},
  "oclif": {
    "plugins": ["@oclif/plugin-plugins"],
    "scope": "myscope",         // enables: mycli plugins install myplugin
    "pluginPrefix": "plugin"    // resolves to @myscope/plugin-myplugin
  }
}
```

This adds these commands automatically:

```bash
mycli plugins                    # list installed
mycli plugins install <plugin>   # install from npm
mycli plugins install ./local    # install from local path
mycli plugins link ./local       # symlink for development
mycli plugins uninstall <plugin>
mycli plugins update
mycli plugins reset              # remove all user plugins
```

## `this.config` — Runtime Access

Available as `this.config` in any command or hook.

```typescript
this.config.bin           // 'mycli'
this.config.version       // '1.2.3'
this.config.platform      // 'darwin' | 'linux' | 'win32'
this.config.configDir     // ~/.config/mycli
this.config.cacheDir      // ~/.cache/mycli
this.config.dataDir       // ~/.data/mycli

// Get all plugins as array (v4: plugins is a Map)
const plugins = this.config.getPluginsList()

// Run a command programmatically
await this.config.runCommand('other:command', ['--flag=value'])

// Run a hook
await this.config.runHook('my-event', {payload: 'data'})
```

## Command Discovery Strategies

| Strategy | When to use |
|----------|-------------|
| `"./dist/commands"` (default) | Standard projects — glob-based discovery |
| `{strategy: "explicit"}` | Bundled CLIs (webpack/esbuild); no manifest support |
| `{strategy: "single"}` | Single-command CLIs |

## References

- [Hooks reference](references/HOOKS.md) — hook types and event payload shapes
- [oclif.io configuration](https://oclif.io/docs/configuring_your_cli/)
- [oclif.io plugins](https://oclif.io/docs/plugins/)
- [oclif.io hooks](https://oclif.io/docs/hooks/)
- [oclif.io multi-command CLIs](https://oclif.io/docs/multi/)
