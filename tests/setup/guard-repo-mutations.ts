// Vitest setup: fail loudly if a test mutates the repo's OWN tracked customization files.
//
// This repo dogfoods Bonsai-adjacent agent assets: it installs skills/instructions/custom agents under
// .agents/skills, .claude/skills, .cursor/*, .github/* and tracks them in skills-lock.json. A test
// that runs a mutating command (add/remove/sync/agents) with cwd === the repo root — instead of an
// isolated temp directory — installs into or deletes those tracked files and rewrites the lockfile.
// Because `git add -A` then sweeps the collateral damage into a commit, such a leak has twice
// silently corrupted the repo (deleted 72 tracked files; later installed a stray skill).
//
// Vitest runs setupFiles in each test file's context, so the top-level `afterAll` below runs after
// every file's suite and compares a before/after snapshot of the protected paths. A mismatch throws,
// failing that file (and the pre-push coverage gate) — so the corruption surfaces on the test run
// instead of being silently committed. The snapshot resolves paths from THIS file's location, never
// process.cwd(), since a test may have chdir'd into a temp dir.
//
// This is per-file detection under the default pool (`forks`, isolate: true): the baseline is
// captured fresh per file. Setting `isolate: false` or `poolOptions.forks.singleFork: true` would
// capture one baseline across files and silently weaken the guard to suite-level — keep the default.
import { afterAll } from 'vitest';
import { lstatSync, readdirSync, readlinkSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// The dogfooded install targets plus the lockfile. Mutating commands write/delete here at cwd.
const PROTECTED_PATHS = [
  'skills-lock.json',
  '.agents/skills',
  '.agents/rules',
  '.claude/skills',
  '.cursor/rules',
  '.cursor/agents',
  '.github/instructions',
  '.github/agents',
];

/** A stable signature for one protected path: absent, a file (size), or a recursive entry manifest. */
function signature(rel: string): string {
  const abs = join(REPO_ROOT, rel);
  let st: ReturnType<typeof statSync>;
  try {
    st = statSync(abs);
  } catch {
    return 'absent';
  }
  if (st.isFile()) return `file:${st.size}`;

  // Record symlinks by their target (don't follow) so a deleted/retargeted skill link is caught
  // without descending into the same canonical content twice. Real files record their size.
  const entries: string[] = [];
  const walk = (dir: string): void => {
    for (const dirent of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    )) {
      const child = join(dir, dirent.name);
      const childRel = relative(REPO_ROOT, child);
      if (dirent.isSymbolicLink()) {
        entries.push(`${childRel}->${safeReadlink(child)}`);
      } else if (dirent.isDirectory()) {
        walk(child);
      } else {
        entries.push(`${childRel}:${safeSize(child)}`);
      }
    }
  };
  walk(abs);
  return `dir:[${entries.join(',')}]`;
}

function safeReadlink(path: string): string {
  try {
    return readlinkSync(path);
  } catch {
    return 'unreadable';
  }
}

// Called only on regular-file dirents from walk() (symlinks/dirs are handled before this). Uses
// lstatSync so a stray symlink path would report its own size rather than silently following it.
function safeSize(path: string): number {
  try {
    return lstatSync(path).size;
  } catch {
    return -1;
  }
}

function snapshot(): Map<string, string> {
  return new Map(PROTECTED_PATHS.map((rel) => [rel, signature(rel)]));
}

const baseline = snapshot();

afterAll(() => {
  const current = snapshot();
  const changed = PROTECTED_PATHS.filter((rel) => current.get(rel) !== baseline.get(rel));
  if (changed.length === 0) return;

  throw new Error(
    `Repo-tracked customization files were mutated by this test file:\n` +
      changed.map((rel) => `  - ${rel}`).join('\n') +
      `\n\nA test ran a mutating command (add/remove/sync/agents) against the repo root instead of ` +
      `an isolated temp directory, corrupting the dogfooded skills and skills-lock.json. ` +
      `Run mutating commands with cwd set to a throwaway dir: pass an explicit cwd to the ` +
      `subprocess runner (tests/helpers/cli-runner.ts defaultCwd()), or process.chdir(tempDir) in ` +
      `beforeEach and restore it in afterEach for in-process calls.`
  );
});
