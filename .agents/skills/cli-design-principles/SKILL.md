---
name: cli-design-principles
description: 'General principles for designing well-behaved, user-friendly CLI tools. Use when designing command structure, naming flags and args, writing help text, handling errors, managing configuration, or deciding how a CLI should behave in interactive vs non-interactive contexts. Applies to any OCLIF-based or Node.js CLI.'
metadata:
  version: '1.0.0'
  category: CLI Development
  tags:
    - cli
    - ux
    - design
    - oclif
    - node
    - best-practices
---

# CLI Design Principles

Foundational design principles for building CLIs that behave predictably, fail gracefully, and feel good to use. Grounded in [clig.dev](https://clig.dev), the [12 Factor CLI Apps guide](https://jdxcode.medium.com/12-factor-cli-apps-dd3c227a0e46), and the Heroku CLI Style Guide.

## When to Use This Skill

- Designing a new command's argument and flag structure
- Naming flags and writing help text
- Writing error messages that guide users to a fix
- Deciding how a command should behave when piped vs used interactively
- Setting up configuration files and environment variable handling
- **Not for:** Output formatting or progress indicators — see [cli-output-design](../cli-output-design/SKILL.md)

---

## Args vs Flags: When to Use Each

**Default to flags.** Flags are explicit, order-independent, autocomplete-friendly, and produce better error messages. Use positional args sparingly.

**Use positional args only when:**
- There is exactly one argument with an unambiguous meaning
- Multiple arguments are of the same type and order doesn't matter (`rm file1 file2`)
- The ordering is universal convention (`cp <source> <dest>`)

**Use flags when two or more parameters have distinct meanings.** The extra typing is worth the clarity:

```bash
# Ambiguous positional args — avoid this:
mycli fork destapp sourceapp

# Explicit flags — prefer this:
mycli fork --from sourceapp --to destapp
```

**Rule of thumb** (12 Factor): one argument type is acceptable, two is questionable, three or more is a design smell.

---

## Flag Naming Conventions

- Use `--kebab-case` for multi-word flags — never camelCase or underscores
- Every flag must have a `--long-form`; reserve `-x` short forms for frequently-used flags only
- Support both `--flag=value` and `--flag value`
- Support `--` to end flag parsing and pass remaining tokens downstream
- Use `--flag` / `--no-flag` pairs for boolean toggles (`Flags.boolean({allowNo: true})`)

### Standard Flag Names — Reuse These

Consistent names across tools reduce learning cost.

| Flag | Meaning |
|------|---------|
| `-a, --all` | Include all items (hidden, inactive, etc.) |
| `-f, --force` | Skip safety checks; required for destructive ops in scripts |
| `-h, --help` | Help — **reserve exclusively for this** |
| `-n, --dry-run` | Preview without executing |
| `-o, --output` | Output file path |
| `-q, --quiet` | Suppress non-essential output |
| `-v, --verbose` | Increase output verbosity |
| `-V, --version` | Show version |
| `--json` | Machine-readable JSON output |
| `--no-color` | Disable ANSI color |
| `--no-input` | Disable interactive prompts |

---

## Security: Never Accept Secrets as Flags

Flag values are visible in process listings (`ps aux`) and shell history. For tokens, passwords, and keys:

```bash
# Never do this:
mycli deploy --token abc123

# Do this instead:
mycli deploy --token-file ~/.mycli/token     # read from file
echo "$TOKEN" | mycli deploy                  # read from stdin pipe
mycli deploy                                  # prompt interactively
```

Use environment variables only with caveats (they leak into subprocesses). For anything sensitive, prefer a restricted-permission credentials file (`chmod 600`) or an interactive prompt.

---

## Help Text

### `-h`/`--help` must always work

Reserved unconditionally for help. Never repurpose it. Support all of:
- `mycli --help`
- `mycli help`
- `mycli help <command>`
- `mycli <command> --help`

If a command requires arguments and receives none, show concise help and exit.

### Two-level structure

**Concise** (no args given): one-sentence description, 1–2 examples, most important flags, link to full help.

**Full** (`--help`): all flags with descriptions, all subcommands, more examples, docs URL.

### Flag description rules

```
FLAGS
  -a, --app=APP     app to run command against
  -e, --env=ENV     target environment (default: development)
  -f, --force       skip confirmation prompts
  --json            output raw JSON
```

- Start with a **lowercase letter**
- Do **not** end with a period
- Fit within ~80 characters
- Required for every flag

### Lead with examples

Users go to examples before reading anything else. Put the most common, representative use case first. Show expected output when it clarifies behavior.

---

## Error Messages

### Catch and rewrite errors for humans

Never let raw system errors reach the user.

```
# Bad — raw node error:
EACCES: permission denied, open 'config.json'

# Good — actionable message:
Can't read config.json. Make the file readable: chmod +r config.json
```

### Error message anatomy

1. **What went wrong** (one line)
2. **Why** (optional for obvious cases)
3. **What to do next** (the most important part)
4. **Docs URL** (for complex issues)

OCLIF's `this.error()` supports all of these:

```typescript
this.error('No app specified.', {
  code: 'NO_APP',
  exit: 1,
  suggestions: ['Run mycli deploy --app <name>'],
  ref: 'https://docs.example.com/deploy',
})
```

### Error placement

- All error messages go to **stderr**, not stdout
- Place the most important information **last** — users scan to the bottom
- Group batches of similar errors under a single header rather than printing 50 near-identical lines
- Use red sparingly — if everything is red, nothing is urgent

### Typo suggestions

Detect likely typos and suggest corrections:
```
$ mycli statuss
Unknown command: statuss. Did you mean "status"?
```

Do **not** silently execute the corrected command — ask or error, so users learn the right syntax.

---

## Verbosity Patterns

```
--quiet / -q     Errors only (for scripts that check exit codes)
default          Confirmation messages and state changes
--verbose / -v   Detailed timing, request/response info
--debug / -d     Full trace output, internal state
```

Also support `DEBUG=mycli:*` as an env-var alternative to `--debug`. This is broadly understood in the Node.js ecosystem.

### What to emit at each level

| Level | Shows |
|-------|-------|
| `--quiet` | Errors only |
| Default | "Deployed myapp to production." + next-step hint |
| `--verbose` | HTTP request details, sub-step status |
| `--debug` | Full stack traces, internal state, timing |

**Always say something on success.** Silence makes users think the command is broken or still running. A brief "Done." costs nothing.

---

## Interactive vs Non-Interactive Mode

### TTY detection

```typescript
const isInteractive = process.stdin.isTTY === true
```

Only prompt, animate, and use color when connected to a real terminal.

### Behavior matrix

| Behavior | Interactive (TTY) | Non-interactive (pipe/CI) |
|----------|-------------------|--------------------------|
| Missing required input | Prompt the user | Error + list required flags |
| Destructive operation | "Are you sure? [y/N]" | Require `--force` |
| Progress | Spinner / progress bar | Plain status lines to stderr |
| Color | ANSI colors | Plain text |
| Password | Prompt with echo off | Require `--password-file` |

### Risk-calibrated confirmation

```
Low risk (reversible local change):  optional prompt
Moderate risk (remote resource):     "Are you sure? [y/N]" / require --force
High risk (production, irreversible): type the resource name to confirm
```

OCLIF example of the highest-risk pattern:
```typescript
const {flags} = await this.parse(DeleteApp)
if (!this.jsonEnabled()) {
  const name = await input({message: `Type "${flags.app}" to confirm deletion:`})
  if (name !== flags.app) this.error('Confirmation did not match.', {exit: 1})
}
```

Always provide `--no-input` to disable all prompts for CI/scripting.

---

## Configuration Files

### Three categories of configuration

| Category | Use |
|----------|-----|
| Per-invocation (debug, dry-run) | CLI flags |
| Per-machine / per-project | Flags, env vars, `.env`, project config |
| Version-controlled project settings | Config file committed to the repo |

### Precedence (highest to lowest)

```
CLI flags → Environment variables → Project config → User config → System config → Defaults
```

### XDG Base Directory paths

Follow the [XDG spec](https://specifications.freedesktop.org/basedir-spec/latest/) — OCLIF does this automatically:

| Dir | Linux | macOS | Windows |
|-----|-------|-------|---------|
| Config | `~/.config/mycli` | `~/.config/mycli` | `%LOCALAPPDATA%\mycli` |
| Data | `~/.local/share/mycli` | `~/.local/share/mycli` | `%LOCALAPPDATA%\mycli` |
| Cache | `~/.cache/mycli` | `~/Library/Caches/mycli` | `%LOCALAPPDATA%\mycli` |

Access from a command: `this.config.configDir`, `this.config.dataDir`, `this.config.cacheDir`.

### Environment variable naming

```bash
MYCLI_API_KEY=xxx    # prefix with CLI name
MYCLI_DEBUG=1
MYCLI_NO_COLOR=1
```

Respect standard env vars: `NO_COLOR`, `FORCE_COLOR`, `DEBUG`, `EDITOR`, `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`, `PAGER`, `TERM`.

### What not to store

- Never commit secrets to config files
- Store credentials in a `chmod 600` file in `configDir`, not in a generic `.env`
- Never modify system files (`.bashrc`, etc.) without explicit user consent

---

## References

- [Error handling & confirmation patterns](references/ERRORS-AND-CONFIRMATION.md)
- [clig.dev — Command Line Interface Guidelines](https://clig.dev)
- [12 Factor CLI Apps](https://jdxcode.medium.com/12-factor-cli-apps-dd3c227a0e46)
- [Heroku CLI Style Guide](https://devcenter.heroku.com/articles/cli-style-guide)
- [Node.js CLI Best Practices](https://github.com/lirantal/nodejs-cli-apps-best-practices)
