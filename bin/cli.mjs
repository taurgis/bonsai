#!/usr/bin/env node

import { execute } from '@oclif/core';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeArgv } from '../dist/lib/argv.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Normalize argv so the whole oclif pipeline sees one consistent command. oclif's
// error handler re-reads process.argv (not the args passed to execute) when it renders
// help on a parse error, so rewriting only the execute() args leaves the help renderer
// trying to resolve the bare URL as a command — which crashes with a stack trace. Rewrite
// process.argv itself so both the run path and the help/error path agree.
const rawArgv = process.argv.slice(2);
const result = normalizeArgv(rawArgv);

if (result.exitWithJson) {
  process.exitCode = result.exitWithJson.exitCode;
  console.log(JSON.stringify(result.exitWithJson.envelope, null, 2));
  process.exit();
}

process.argv = [process.argv[0], process.argv[1], ...result.argv];

await execute({
  development: false,
  dir: __dirname + '/../',
});
