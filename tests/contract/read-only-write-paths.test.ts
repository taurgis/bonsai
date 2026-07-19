/**
 * Audit #74 / parent #71: every write path honors effective dry-run
 * (--read-only/--plan, BONSAI_READ_ONLY/BONSAI_PLAN_MODE), both storage modes,
 * consistent would_* / dryRun vocabulary, and no artifact/index/config left behind.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  existsSync,
  readdirSync,
  readFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runContract, type RunResult } from './runner.ts';
import { hasInternetAccess } from '../helpers/network.ts';

const HIT_URL = 'https://example.com/readonly-contract-hit';
const PROJECT_CONFIG = '.bonsai.json';
const SEARCH_INDEX = '.search-index.json';

/** Four spellings of effective read-only (flag OR env). */
const READ_ONLY_SPELLINGS = [
  { name: '--read-only', args: ['--read-only'] as string[], env: {} },
  { name: '--plan', args: ['--plan'] as string[], env: {} },
  { name: 'BONSAI_READ_ONLY', args: [] as string[], env: { BONSAI_READ_ONLY: '1' } },
  { name: 'BONSAI_PLAN_MODE', args: [] as string[], env: { BONSAI_PLAN_MODE: '1' } },
] as const;

let cwd: string;
let xdg: string;
let cfg: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'bonsai-ro-cwd-'));
  xdg = mkdtempSync(join(tmpdir(), 'bonsai-ro-xdg-'));
  cfg = mkdtempSync(join(tmpdir(), 'bonsai-ro-cfg-'));
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
  rmSync(xdg, { recursive: true, force: true });
  rmSync(cfg, { recursive: true, force: true });
});

function env(extra: Record<string, string> = {}) {
  // Explicit falsey overrides so an ambient harness env cannot leak into assertions.
  return {
    XDG_DATA_HOME: xdg,
    XDG_CONFIG_HOME: cfg,
    BONSAI_READ_ONLY: '0',
    BONSAI_PLAN_MODE: '0',
    ...extra,
  };
}

function run(
  args: string[],
  options: { env?: Record<string, string>; raw?: boolean; input?: string } = {}
): RunResult {
  return runContract(args, {
    cwd,
    env: env(options.env),
    raw: options.raw ?? true,
    input: options.input,
  });
}

function parseData(result: RunResult): Record<string, unknown> {
  expect(result.exitCode).toBe(0);
  const envelope = JSON.parse(result.stdout) as { data: Record<string, unknown> };
  return envelope.data;
}

function noteFile(name: string, body: string): string {
  const path = join(cwd, name);
  writeFileSync(path, body, 'utf-8');
  return name;
}

function projectResearchDir(): string {
  return join(cwd, '.bonsai', 'research');
}

function globalResearchDir(): string {
  return join(xdg, 'bonsai', 'research');
}

function researchFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.md') || f === SEARCH_INDEX);
}

function seedProjectImport(url = HIT_URL): void {
  const file = noteFile('seed.md', '# Seed\nReadonly contract seed.\n');
  const seeded = run(
    ['import', url, '--file', file, '--topic', 'readonly-seed', '--json'],
    { env: { BONSAI_STORAGE: 'project' } }
  );
  expect(seeded.exitCode).toBe(0);
  expect(researchFiles(projectResearchDir()).some((f) => f.endsWith('.md'))).toBe(true);
}

describe('config set/unset under effective read-only', () => {
  for (const spelling of READ_ONLY_SPELLINGS) {
    it(`config set previews would_set and writes nothing (${spelling.name})`, () => {
      const data = parseData(
        run(['config', 'set', 'storage', 'project', '--local', '--json', ...spelling.args], {
          env: spelling.env,
        })
      );
      expect(data).toMatchObject({
        key: 'storage',
        value: 'project',
        scope: 'project',
        dryRun: true,
        status: 'would_set',
      });
      expect(existsSync(join(cwd, PROJECT_CONFIG))).toBe(false);
    });

    it(`config unset previews would_unset and leaves config untouched (${spelling.name})`, () => {
      // Seed a real project config first (writable run).
      expect(
        run(['config', 'set', 'storage', 'project', '--local', '--json']).exitCode
      ).toBe(0);
      const before = readFileSync(join(cwd, PROJECT_CONFIG), 'utf-8');

      const data = parseData(
        run(['config', 'unset', 'storage', '--local', '--json', ...spelling.args], {
          env: spelling.env,
        })
      );
      expect(data).toMatchObject({
        key: 'storage',
        scope: 'project',
        dryRun: true,
        status: 'would_unset',
      });
      expect(readFileSync(join(cwd, PROJECT_CONFIG), 'utf-8')).toBe(before);
    });
  }

  it('config set --read-only also leaves user-scope config untouched', () => {
    const userConfig = join(cfg, 'bonsai', 'config.json');
    const data = parseData(
      run(['config', 'set', 'storage', 'project', '--json', '--read-only'])
    );
    expect(data).toMatchObject({ scope: 'user', dryRun: true, status: 'would_set' });
    expect(existsSync(userConfig)).toBe(false);
  });
});

describe('import under effective read-only (both storage modes)', () => {
  for (const spelling of READ_ONLY_SPELLINGS) {
    it(`project storage: import reports would_import and writes no artifact/index (${spelling.name})`, () => {
      const file = noteFile('ro-import.md', '# RO import\nNo persist.\n');
      const data = parseData(
        run(
          [
            'import',
            `https://example.com/ro-import-${spelling.name}`,
            '--file',
            file,
            '--topic',
            'ro-import',
            '--json',
            ...spelling.args,
          ],
          { env: { ...spelling.env, BONSAI_STORAGE: 'project' } }
        )
      );
      expect(data).toMatchObject({ dryRun: true });
      expect((data.cache as { status: string }).status).toBe('would_import');
      expect(researchFiles(projectResearchDir())).toEqual([]);
      expect(researchFiles(globalResearchDir())).toEqual([]);
    });
  }

  it('global storage: import --plan writes nothing under XDG data home', () => {
    const file = noteFile('ro-global.md', '# RO global\nNo persist.\n');
    const data = parseData(
      run(
        [
          'import',
          'https://example.com/ro-import-global',
          '--file',
          file,
          '--topic',
          'ro-global',
          '--storage',
          'global',
          '--plan',
          '--json',
        ],
        { env: { BONSAI_STORAGE: 'global' } }
      )
    );
    expect(data).toMatchObject({ dryRun: true });
    expect((data.cache as { status: string; storage: string }).status).toBe('would_import');
    expect((data.cache as { storage: string }).storage).toBe('global');
    expect(researchFiles(globalResearchDir())).toEqual([]);
    expect(researchFiles(projectResearchDir())).toEqual([]);
  });
});

describe('prune under effective read-only', () => {
  for (const spelling of READ_ONLY_SPELLINGS) {
    it(`prune previews would_prune and deletes nothing (${spelling.name})`, () => {
      const url = `https://example.com/ro-prune-${encodeURIComponent(spelling.name)}`;
      seedProjectImport(url);
      const before = researchFiles(projectResearchDir()).filter((f) => f.endsWith('.md'));
      expect(before.length).toBeGreaterThan(0);

      const data = parseData(
        run(['prune', '--url', url, '--json', ...spelling.args], {
          env: { ...spelling.env, BONSAI_STORAGE: 'project' },
        })
      );
      expect(data).toMatchObject({
        dryRun: true,
        status: 'would_prune',
        prunedCount: 0,
      });
      expect(data.candidateCount).toBeGreaterThan(0);
      expect(data.wouldPruneCount).toBe(data.candidateCount);
      expect(researchFiles(projectResearchDir()).filter((f) => f.endsWith('.md'))).toEqual(before);
    });
  }
});

describe('search-index metadata writes under read-only', () => {
  it('list --read-only does not create .search-index.json', () => {
    seedProjectImport();
    expect(existsSync(join(projectResearchDir(), SEARCH_INDEX))).toBe(false);

    const listed = run(['list', '--read-only', '--json'], {
      env: { BONSAI_STORAGE: 'project' },
    });
    expect(listed.exitCode).toBe(0);
    expect(existsSync(join(projectResearchDir(), SEARCH_INDEX))).toBe(false);
  });

  it('list without read-only may persist the search index (writable baseline)', () => {
    seedProjectImport();
    expect(run(['list', '--json'], { env: { BONSAI_STORAGE: 'project' } }).exitCode).toBe(0);
    expect(existsSync(join(projectResearchDir(), SEARCH_INDEX))).toBe(true);
  });
});

describe('fetch under effective read-only still executes', () => {
  it('fetch --read-only returns content with would_fetch and writes no artifact', async (ctx) => {
    if (!(await hasInternetAccess())) ctx.skip('no internet access in this sandbox');
    const data = parseData(
      run(['https://example.com/', '--read-only', '--json'], {
        env: { BONSAI_STORAGE: 'project' },
      })
    );
    expect(data).toMatchObject({ dryRun: true });
    expect((data.cache as { status: string }).status).toBe('would_fetch');
    expect(typeof data.content).toBe('string');
    expect(String(data.content).length).toBeGreaterThan(0);
    expect(researchFiles(projectResearchDir())).toEqual([]);
    expect(researchFiles(globalResearchDir())).toEqual([]);
  });
});

describe('dry-run / write-status vocabulary consistency', () => {
  it('human and json preview vocabulary agree for config set --plan', () => {
    const human = run(['config', 'set', 'storage', 'project', '--local', '--plan'], {
      raw: false,
    });
    expect(human.exitCode).toBe(0);
    expect(human.stdout).toContain('[dry-run]');
    expect(human.stdout).toMatch(/Would set/i);

    const json = parseData(
      run(['config', 'set', 'storage', 'project', '--local', '--plan', '--json'])
    );
    expect(json).toMatchObject({ dryRun: true, status: 'would_set' });
  });

  it('import --json under BONSAI_PLAN_MODE uses dryRun + would_import', () => {
    const file = noteFile('vocab.md', '# Vocab\n');
    const data = parseData(
      run(['import', 'https://example.com/ro-vocab', '--file', file, '--topic', 'vocab', '--json'], {
        env: { BONSAI_PLAN_MODE: '1', BONSAI_STORAGE: 'project' },
      })
    );
    expect(data.dryRun).toBe(true);
    expect((data.cache as { status: string }).status).toBe('would_import');
  });
});
