#!/usr/bin/env node

/**
 * File-size gate. Enforces code-structure rule #1: no production file under
 * `src/` (excluding `*.test.ts` and fixtures) may reach 1000 lines.
 *
 * Fallow gates complexity, dead code, and duplication, but has no per-file
 * line ceiling, so this script covers that one rule.
 *
 * Modes:
 *   (default)  Check only files staged for commit. Used by the pre-commit hook.
 *   --all      Check every tracked production file under `src/`. Used by
 *              `pnpm lint:line-counts` and as a full-repo audit.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { collectFilesRecursively } from './file-utils.ts';

/** A file reaching this many lines is rejected. The ceiling is 1000. */
export const LINE_CEILING = 1000;

const rootDir = path.resolve(import.meta.dirname, '..');

/** A production source file is a `.ts` file under `src/`, excluding tests and fixtures. */
export function isProductionSource(repoRelPath: string): boolean {
  const posix = repoRelPath.split(path.sep).join('/');
  return (
    posix.startsWith('src/') &&
    posix.endsWith('.ts') &&
    !posix.endsWith('.test.ts') &&
    !posix.includes('__fixtures__/')
  );
}

/** Count source lines, ignoring the empty element a trailing newline produces. */
export function countLines(content: string): number {
  const lines = content.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines.length;
}

/** A blob with a NUL byte is binary; counting "lines" on it is meaningless. */
export function isBinary(content: string): boolean {
  return content.includes(String.fromCharCode(0));
}

/** Run git with an explicit argv (never a shell string) so filenames cannot inject. */
function git(args: string[]): string {
  const result = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr?.trim() ?? 'unknown error'}`);
  }
  return result.stdout;
}

/** List production source files staged for the current commit. */
function stagedProductionFiles(): string[] {
  const output = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR']);
  return output.split('\n').filter(Boolean).filter(isProductionSource);
}

/** List every production source file tracked under `src/`. */
function allProductionFiles(): string[] {
  const srcDir = path.join(rootDir, 'src');
  if (!existsSync(srcDir)) return [];
  return collectFilesRecursively(srcDir, (filePath) =>
    isProductionSource(path.relative(rootDir, filePath))
  ).map((filePath) => path.relative(rootDir, filePath));
}

/**
 * Read the content that will actually be committed. For staged checks we read
 * the index blob (`git show :path`) so unstaged hunks in the working tree do
 * not skew the count; for `--all` we read the working tree directly.
 */
function readContent(repoRelPath: string, fromIndex: boolean): string {
  return fromIndex
    ? git(['show', `:${repoRelPath}`])
    : readFileSync(path.join(rootDir, repoRelPath), 'utf8');
}

function findOffenders(
  files: string[],
  fromIndex: boolean
): Array<{ file: string; lines: number }> {
  const offenders: Array<{ file: string; lines: number }> = [];
  for (const file of files) {
    const content = readContent(file, fromIndex);
    if (isBinary(content)) continue;
    const lines = countLines(content);
    if (lines >= LINE_CEILING) offenders.push({ file, lines });
  }
  return offenders;
}

function main(): void {
  const checkAll = process.argv.includes('--all');
  const files = checkAll ? allProductionFiles() : stagedProductionFiles();
  const offenders = findOffenders(files, !checkAll);

  if (offenders.length === 0) return;

  console.error(
    `\nFile-size gate failed: ${offenders.length} file(s) reach the ${LINE_CEILING}-line ceiling.`
  );
  for (const { file, lines } of offenders) {
    console.error(`  ${file} — ${lines} lines (ceiling ${LINE_CEILING})`);
  }
  console.error('\nSplit the file by responsibility into focused modules under src/lib/<domain>/');
  console.error('before committing (see .github/instructions/code-structure.instructions.md).');
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  main();
}
