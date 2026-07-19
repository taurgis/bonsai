---
name: oclif-testing
description: 'Test OCLIF v4 commands, hooks, and output using @oclif/test. Use when writing unit tests for CLI commands, capturing stdout/stderr output, asserting JSON results, or testing hook behavior.'
metadata:
  version: '1.0.0'
  category: CLI Development
  tags:
    - oclif
    - cli
    - testing
    - mocha
    - typescript
---

# OCLIF Testing

Testing patterns for OCLIF v4 commands and hooks using `@oclif/test` v4. Uses Mocha + Chai by default; Vitest is supported with one config flag.

## When to Use This Skill

- Writing tests for CLI commands (flags, args, output, return values)
- Testing error paths and exit codes
- Testing hooks
- Asserting `--json` output
- **Not for:** Integration tests that need a real running service — mock those boundaries instead

## Prerequisites

```bash
npm install --save-dev @oclif/test mocha chai @types/mocha @types/chai ts-node
```

`.mocharc.json`:
```json
{
  "require": ["ts-node/register"],
  "spec": "test/**/*.test.ts",
  "timeout": 10000
}
```

## Primary API: `runCommand`

`runCommand` is the main testing API in `@oclif/test` v4. It loads the CLI from disk (via the manifest or command discovery) and runs the command in-process.

```typescript
import {expect} from 'chai'
import {runCommand} from '@oclif/test'
import {join} from 'node:path'

const root = join(__dirname, '../..')  // directory containing package.json

describe('deploy', () => {
  it('runs with required flags', async () => {
    const {stdout, result} = await runCommand<{app: string; env: string}>(
      ['deploy', 'myapp', '--env=prod'],
      {root}
    )
    expect(stdout).to.include('Deploying myapp')
    expect(result?.app).to.equal('myapp')
    expect(result?.env).to.equal('prod')
  })

  it('handles missing required flag', async () => {
    const {error} = await runCommand(['deploy', 'myapp'], {root})
    expect(error?.message).to.include('Missing required flag')
  })

  it('handles exit codes', async () => {
    const {error} = await runCommand(['failing-cmd'], {root})
    expect(error?.oclif?.exit).to.equal(1)
  })
})
```

### `runCommand` return shape

| Property | Type | Description |
|----------|------|-------------|
| `stdout` | `string` | Captured standard output |
| `stderr` | `string` | Captured standard error |
| `result` | `T \| undefined` | Return value of `run()` |
| `error` | `Error \| undefined` | Thrown error (if any) |

### `runCommand` options

```typescript
await runCommand(['cmd', '--flag'], {
  root,                    // required: path to CLI package.json dir
  print: false,            // also print to real stdout/stderr
  stripAnsi: true,         // strip ANSI codes (default: true)
})

// Pass an existing Config instead of root path:
import {Config} from '@oclif/core'
const config = await Config.load(root)
await runCommand(['cmd'], config)
```

## `captureOutput` — Test a Command Class Directly

Use when you want to test a command class without full CLI config loading:

```typescript
import {captureOutput} from '@oclif/test'
import DeployCommand from '../../src/commands/deploy.js'

it('captures output', async () => {
  const {stdout, stderr, result, error} = await captureOutput(
    async () => DeployCommand.run(['myapp', '--env=prod'])
  )
  expect(stdout).to.include('Deploying')
  expect(result).to.deep.equal({app: 'myapp', env: 'prod'})
})

// Options:
captureOutput(fn, {
  print: true,           // also print to real stdout/stderr
  stripAnsi: false,      // keep ANSI codes
})
```

## Testing JSON Output

```typescript
it('returns JSON with --json flag', async () => {
  const {stdout, result} = await runCommand<{id: string}>(
    ['deploy', 'myapp', '--env=prod', '--json'],
    {root}
  )
  // stdout is the JSON string when --json is active
  const parsed = JSON.parse(stdout)
  expect(parsed.id).to.be.a('string')
  expect(result?.id).to.equal(parsed.id)
})
```

## Testing Error Paths

```typescript
it('exits with code 1 on auth failure', async () => {
  const {error} = await runCommand(['deploy', '--env=prod'], {root})
  expect(error?.oclif?.exit).to.equal(1)
  expect(error?.message).to.include('Not authenticated')
})

it('exits 0 on --help', async () => {
  // --help causes a normal exit, not an error
  const {error} = await runCommand(['deploy', '--help'], {root})
  // error is undefined for exit code 0
  expect(error).to.be.undefined
})
```

## Testing Hooks

```typescript
import {runHook} from '@oclif/test'

describe('init hook', () => {
  it('logs initialization', async () => {
    const {stdout} = await runHook('init', {id: 'deploy'}, {root})
    expect(stdout).to.include('Initializing')
  })
})
```

## Vitest Setup

```typescript
// vitest.config.ts
export default {
  test: {
    disableConsoleIntercept: true,  // required for @oclif/test stdout capture
  },
}
```

Then use `runCommand` and `captureOutput` identically — `@oclif/test` is test-runner agnostic.

## Common Patterns

### Stub external calls

`@oclif/test` does not bundle a stubbing library. Use `sinon` or `jest.mock` for mocking:

```typescript
import sinon from 'sinon'
import * as api from '../../src/api.js'

describe('deploy', () => {
  let stub: sinon.SinonStub

  beforeEach(() => {
    stub = sinon.stub(api, 'deployApp').resolves({id: 'deploy-123'})
  })

  afterEach(() => stub.restore())

  it('calls the API', async () => {
    const {result} = await runCommand<{id: string}>(['deploy', 'myapp', '--env=prod'], {root})
    expect(stub.calledOnce).to.be.true
    expect(result?.id).to.equal('deploy-123')
  })
})
```

### Environment variable flags

```typescript
it('reads from env var', async () => {
  process.env.DEPLOY_ENV = 'staging'
  const {stdout} = await runCommand(['deploy', 'myapp'], {root})
  expect(stdout).to.include('staging')
  delete process.env.DEPLOY_ENV
})
```

### Test multiple args shapes

```typescript
for (const [desc, argv, expected] of [
  ['with explicit env', ['deploy','myapp','--env=prod'], 'prod'],
  ['defaults to dev',   ['deploy','myapp'],              'dev'],
]) {
  it(desc, async () => {
    const {result} = await runCommand<{env: string}>(argv as string[], {root})
    expect(result?.env).to.equal(expected)
  })
}
```

## Quick Reference

| API | Best for |
|-----|---------|
| `runCommand(argv, {root})` | Full integration test via CLI config |
| `captureOutput(() => Cmd.run(argv))` | Unit test a specific command class |
| `runHook(event, payload, {root})` | Test a hook in isolation |

## References

- [@oclif/test v4 README](https://github.com/oclif/test/blob/main/README.md)
- [oclif.io testing docs](https://oclif.io/docs/testing/)
