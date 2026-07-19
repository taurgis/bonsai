---
name: oclif-development
description: >
  Build and test oclif commands: command classes, typed flags and arguments,
  --json output via enableJsonFlag, error handling and exit codes, and
  testing with @oclif/test's runCommand. Use when writing or reviewing any
  command, flag definition, error path, or command test in an oclif-based
  CLI such as Bonsai.
license: MIT
metadata:
  version: '1.0.0'
  sources:
    - https://oclif.io/docs/commands
    - https://oclif.io/docs/flags
    - https://oclif.io/docs/json
    - https://oclif.io/docs/error_handling
    - https://oclif.io/docs/testing
---

# oclif Development

Repo-relevant distillation of the official oclif documentation. When
behavior beyond this file matters, fetch the current page through Bonsai
(`npx @taurgis/bonsai https://oclif.io/docs/<page>`) rather than trusting
memory.

## Commands

- A command is a class extending `Command` with an async `run()` method.
  Give every command `summary` (one line) and `description` (in-depth,
  multiline allowed) plus at least one entry in `examples`.
- Await every promise inside `run()`: oclif terminates the process 10
  seconds after `run()` resolves, so an un-awaited promise gets killed
  mid-flight.
- Shared behavior across commands (error formatting, common flags, config
  loading) belongs in a custom base class, not copy-pasted per command.

## Flags and arguments

- Declare flags in `static flags` with the typed constructors
  (`Flags.string`, `Flags.boolean`, `Flags.integer`, custom parsers) and
  read them via `await this.parse(MyCommand)`. Never touch
  `process.argv`.
- Give every flag a `summary`; add `char` for common flags; use `options`
  for enumerated values so bad input fails at parse time with a helpful
  message.
- Encode flag relationships declaratively instead of validating by hand:
  `dependsOn`, `exclusive`, `exactlyOne`, `relationships`. Parse-time
  errors beat run-time surprises.
- `env` lets a flag default from an environment variable — use it for
  settings agents set once per session (e.g. read-only mode).

## JSON output

- Set `static enableJsonFlag = true` and **return** the result object from
  `run()`; when the user passes `--json`, oclif prints the return value as
  JSON and suppresses `this.log()` output.
- Suppression only covers the Command logging methods — a stray
  `console.log` corrupts JSON output. This is why bare `console.log` is
  banned in commands.

## Errors and exit codes

- Fail with `this.error('message', {exit: code})` — it prints to stderr and
  sets the exit code. Include the "Try this:" suggestion in the message.
- A command's `catch()` method intercepts errors from its own `run()`;
  override it (usually in the base class) to translate known failures into
  friendly errors, and re-throw anything unexpected for oclif's global
  handler in `bin/run.js`.
- Never let a raw stack trace reach the user on an anticipated failure
  path.

## Testing

- Test commands with `runCommand` from `@oclif/test`: it executes the real
  command in-process and returns `{stdout, stderr, error, result}`.
- Assert on observable contract, not internals: stdout content, exit code
  (`error?.oclif?.exit`), and the parsed `--json` result.
- Mock the network boundary (e.g. `nock`), not the command's own modules —
  tests that stub internals stop failing when the logic breaks.
- Every non-trivial command behavior gets at least one test that fails if
  the behavior regresses, including one error-path test.
