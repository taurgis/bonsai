import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { resolveStoreRoots, projectDataDir, PROJECT_CACHE_DIRNAME } from './store-roots.js';

const GLOBAL = '/data/global';
const CWD = '/work/proj';

describe('resolveStoreRoots', () => {
  it('global mode reads and writes only the global dir', () => {
    const roots = resolveStoreRoots('global', GLOBAL, CWD);
    expect(roots.writeRoot).toBe(GLOBAL);
    expect(roots.globalRoot).toBe(GLOBAL);
    expect(roots.readRoots).toEqual([GLOBAL]);
  });

  it('project mode writes to the project dir and reads project→global (fallback)', () => {
    const roots = resolveStoreRoots('project', GLOBAL, CWD);
    const project = join(CWD, PROJECT_CACHE_DIRNAME);
    expect(roots.writeRoot).toBe(project);
    expect(roots.globalRoot).toBe(GLOBAL);
    expect(roots.readRoots).toEqual([project, GLOBAL]);
  });

  it('projectDataDir places the cache at the cwd', () => {
    expect(projectDataDir(CWD)).toBe(join(CWD, '.bonsai'));
  });
});
