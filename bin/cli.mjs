#!/usr/bin/env node

import { execute } from '@oclif/core';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Normalize argv so the whole oclif pipeline sees one consistent command. oclif's
// error handler re-reads process.argv (not the args passed to execute) when it renders
// help on a parse error, so rewriting only the execute() args leaves the help renderer
// trying to resolve the bare URL as a command — which crashes with a stack trace. Rewrite
// process.argv itself so both the run path and the help/error path agree.
const rawArgv = process.argv.slice(2);
const [firstArg, ...restArgv] = rawArgv;
// Treat any first arg that looks like a URL (carries a scheme) as the `fetch` shorthand.
// Routing wrong-scheme URLs (ftp://, file://) here too means fetch can answer with a clear
// "only http/https" error instead of oclif's cryptic "command not found".
const looksLikeUrl = firstArg?.includes('://') ?? false;
const normalizedArgv =
  firstArg === 'help'
    ? [...restArgv, '--help']
    : looksLikeUrl
      ? ['fetch', ...rawArgv]
      : rawArgv;

process.argv = [process.argv[0], process.argv[1], ...normalizedArgv];

await execute({
  development: false,
  dir: __dirname + '/../',
});
