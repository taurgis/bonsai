#!/usr/bin/env node

import { execute } from '@oclif/core';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_COMMAND_ID = 'Symbol(SINGLE_COMMAND_CLI)';
const TOP_LEVEL_COMMANDS = new Set([
  'config',
  'import',
  'inspect',
  'list',
  'prune',
  'search',
  'status',
]);

const rawArgv = process.argv.slice(2);
const firstArg = rawArgv[0];
const shouldRunRootCommand =
  !firstArg ||
  firstArg.startsWith('-') ||
  firstArg.startsWith('http://') ||
  firstArg.startsWith('https://');
const argv =
  firstArg === '--version' || firstArg === '-v' || TOP_LEVEL_COMMANDS.has(firstArg)
    ? rawArgv
    : shouldRunRootCommand
      ? [ROOT_COMMAND_ID, ...rawArgv]
      : rawArgv;

await execute({
  args: argv,
  development: false,
  dir: __dirname + '/../',
});
