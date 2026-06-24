#!/usr/bin/env node

import { execute } from '@oclif/core';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const rawArgv = process.argv.slice(2);
const [firstArg, ...restArgv] = rawArgv;
const args =
  firstArg === 'help'
    ? [...restArgv, '--help']
    : firstArg?.startsWith('http://') || firstArg?.startsWith('https://')
      ? ['fetch', ...rawArgv]
      : rawArgv;

await execute({
  args,
  development: false,
  dir: __dirname + '/../',
});
