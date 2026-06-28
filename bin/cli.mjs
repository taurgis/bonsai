#!/usr/bin/env node

import { execute } from '@oclif/core';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import updateNotifier from 'update-notifier';
import { createRequire } from 'node:module';

import { normalizeArgv } from '../dist/lib/argv.js';
import { tryUnknownHelpOutput } from '../dist/lib/help-preflight.js';
import { tryJsonMetaOutput } from '../dist/lib/json-meta.js';

const req = createRequire(import.meta.url);
const pkg = req('../package.json');

const __dirname = dirname(fileURLToPath(import.meta.url));

// Normalize argv so the whole oclif pipeline sees one consistent command. oclif's
// error handler re-reads process.argv (not the args passed to execute) when it renders
// help on a parse error, so rewriting only the execute() args leaves the help renderer
// trying to resolve the bare URL as a command — which crashes with a stack trace. Rewrite
// process.argv itself so both the run path and the help/error path agree.
const rawArgv = process.argv.slice(2);
const result = normalizeArgv(rawArgv);
const root = __dirname + '/../';

if (result.exitWithJson) {
  process.exitCode = result.exitWithJson.exitCode;
  console.log(JSON.stringify(result.exitWithJson.envelope, null, 2));
  process.exit();
}

const unknownHelp = await tryUnknownHelpOutput(result.argv, root);
if (unknownHelp) {
  process.exitCode = unknownHelp.exitCode;
  if (unknownHelp.kind === 'json') {
    console.log(JSON.stringify(unknownHelp.envelope, null, 2));
  } else {
    console.error(` ›   Error: ${unknownHelp.message.replaceAll('\n', '\n ›   ')}`);
  }
  process.exit();
}

const jsonMeta = await tryJsonMetaOutput(result.argv, root);
if (jsonMeta) {
  process.exitCode = jsonMeta.exitCode;
  console.log(JSON.stringify(jsonMeta.envelope, null, 2));
  process.exit();
}

// Only notify after the exitWithJson fast-path so the notifier never fires before
// a JSON envelope exits. Also skip under --json so agent callers never see stderr noise.
if (!process.argv.includes('--json')) {
  updateNotifier({ pkg }).notify();
}

process.argv = [process.argv[0], process.argv[1], ...result.argv];

await execute({
  development: false,
  dir: root,
});
