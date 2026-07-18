#!/usr/bin/env node

import { execute } from '@oclif/core';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import updateNotifier from 'update-notifier';
import { createRequire } from 'node:module';

import { normalizeArgv } from '../dist/lib/argv.js';
import { VALUE_TAKING_FLAG_TOKENS } from '../dist/lib/cli-flag-manifest.js';
import { exitWithPreflight } from '../dist/lib/cli-emit.js';
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
const result = normalizeArgv(rawArgv, { valueTakingFlags: VALUE_TAKING_FLAG_TOKENS });
const root = __dirname + '/../';

if (result.earlyExit) {
  exitWithPreflight(result.earlyExit);
}

const unknownHelp = await tryUnknownHelpOutput(result.argv, root);
if (unknownHelp) {
  exitWithPreflight(unknownHelp);
}

const jsonMeta = await tryJsonMetaOutput(result.argv, root);
if (jsonMeta) {
  exitWithPreflight({ ...jsonMeta, json: true });
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
