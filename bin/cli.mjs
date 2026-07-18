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

/** Print a preflight usage envelope (JSON or human) and exit. */
function exitWithEnvelope(result) {
  process.exitCode = result.exitCode;
  if (result.json) {
    const message = String(result.envelope.stderr ?? '');
    if (message) console.error(message);
    console.log(JSON.stringify(result.envelope, null, 2));
  } else {
    const message = String(result.envelope.stderr ?? '');
    console.error(` ›   Error: ${message.replaceAll('\n', '\n ›   ')}`);
  }
  process.exit();
}

// Normalize argv so the whole oclif pipeline sees one consistent command. oclif's
// error handler re-reads process.argv (not the args passed to execute) when it renders
// help on a parse error, so rewriting only the execute() args leaves the help renderer
// trying to resolve the bare URL as a command — which crashes with a stack trace. Rewrite
// process.argv itself so both the run path and the help/error path agree.
const rawArgv = process.argv.slice(2);
const result = normalizeArgv(rawArgv);
const root = __dirname + '/../';

if (result.earlyExit) {
  exitWithEnvelope(result.earlyExit);
}

const unknownHelp = await tryUnknownHelpOutput(result.argv, root);
if (unknownHelp) {
  exitWithEnvelope(unknownHelp);
}

const jsonMeta = await tryJsonMetaOutput(result.argv, root);
if (jsonMeta) {
  process.exitCode = jsonMeta.exitCode;
  const message = String(jsonMeta.envelope.stderr ?? '');
  if (message) console.error(message);
  console.log(JSON.stringify(jsonMeta.envelope, null, 2));
  process.exit();
}

// Only notify after the earlyExit fast-path so the notifier never fires before
// a usage-error envelope exits. Also skip under --json so agent callers never see stderr noise.
if (!process.argv.includes('--json')) {
  updateNotifier({ pkg }).notify();
}

process.argv = [process.argv[0], process.argv[1], ...result.argv];

await execute({
  development: false,
  dir: root,
});
