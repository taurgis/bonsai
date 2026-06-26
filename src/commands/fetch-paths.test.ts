import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Mock the network/browser/IO boundary so the command never touches the wire. The clean seam is
// capturePage (the cache-MISS fetch path), fetchRenderedHtml / fetchStaticHtml / fetchText (the
// revalidation path), and the site registry (custom fetch modules + revalidation lookup). Mocks
// are created via vi.hoisted so the same Mock instances the factories install are the ones the
// test body configures. Vitest 4: vi.restoreAllMocks only resets vi.spyOn spies, so factory mocks
// are reset explicitly with vi.resetAllMocks in afterEach.
const mocks = vi.hoisted(() => ({
  capturePage: vi.fn(),
  fetchRenderedHtml: vi.fn(),
  fetchStaticHtml: vi.fn(),
  fetchText: vi.fn(),
  detectSite: vi.fn(),
  getSiteModuleById: vi.fn(),
}));

vi.mock('../lib/research/capture.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/research/capture.js')>()),
  capturePage: mocks.capturePage,
}));

vi.mock('../lib/research/browser.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/research/browser.js')>()),
  fetchRenderedHtml: mocks.fetchRenderedHtml,
}));

vi.mock('../lib/research/fetcher.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/research/fetcher.js')>()),
  fetchStaticHtml: mocks.fetchStaticHtml,
  fetchText: mocks.fetchText,
}));

vi.mock('../sites/index.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sites/index.js')>()),
  detectSite: mocks.detectSite,
  getSiteModuleById: mocks.getSiteModuleById,
}));

import { Config } from '@oclif/core';
import FetchCommand from './fetch.js';
import { createArtifactFromFetch } from '../lib/research/revalidate.js';
import { writeArtifact, getArtifactPath } from '../lib/research/storage.js';
import { deriveCacheKey } from '../lib/research/cache-key.js';
import { normalizeUrl } from '../lib/research/url.js';
import type { CaptureOutcome } from '../lib/research/capture.js';
import type { FetchResult } from '../lib/research/fetcher.js';
import type { ExtractionResult } from '../lib/research/extract.js';

const TEST_URL = 'https://docs.example.com/guide';

// A FetchResult with controllable validator headers — drives revalidation 200/304 branches.
function fakeFetchResult(overrides: Partial<FetchResult> = {}): FetchResult {
  return {
    status: 200,
    contentType: 'text/html',
    etag: '"abc123"',
    lastModified: 'Wed, 01 Jan 2025 00:00:00 GMT',
    finalUrl: normalizeUrl(TEST_URL),
    responseSize: 1024,
    content: '<html><body><article>Hello world content body.</article></body></html>',
    ...overrides,
  };
}

function fakeExtraction(markdown: string): ExtractionResult {
  return {
    title: 'Guide Title',
    detailedMarkdown: markdown,
    confidence: 'high',
    qualityNotes: ['readability extracted main article'],
  };
}

// A full capturePage outcome for the cache-MISS path. The command reads fetchResult, extraction,
// captureMethod, capabilities, sourceDocUrl off this shape (see fetch.ts applyCaptureMetadata).
function fakeCapture(markdown: string, overrides: Partial<CaptureOutcome> = {}): CaptureOutcome {
  return {
    fetchResult: fakeFetchResult(),
    extraction: fakeExtraction(markdown),
    capabilities: {
      docsEngine: null,
      framework: null,
      recommendedCapture: 'static',
      source: null,
      search: null,
    } as any,
    captureMethod: 'static_fetch',
    sourceDocUrl: null,
    machineReadable: [],
    attemptedMethods: ['static_fetch'],
    ...overrides,
  };
}

const LONG_MARKDOWN =
  '# Guide\n\n' + 'This is a useful paragraph of documentation content. '.repeat(40);

// Seeds a cached artifact on disk so the command takes the cache-HIT branch. fetchedAt controls
// the artifact's age; the freshness policy turns that into fresh / stale_grace / stale_expired.
function seedCachedArtifact(
  dataDir: string,
  fetchedAt: Date,
  tier: 'stable' | 'standard' | 'volatile' = 'standard'
) {
  const normalizedUrl = normalizeUrl(TEST_URL);
  const cacheKey = deriveCacheKey(normalizedUrl);
  const artifact = createArtifactFromFetch(
    TEST_URL,
    normalizedUrl,
    cacheKey,
    fakeFetchResult(),
    fakeExtraction(LONG_MARKDOWN),
    tier,
    null,
    fetchedAt,
    'conservative'
  );
  writeArtifact(dataDir, cacheKey, artifact);
  return { cacheKey, normalizedUrl, artifact };
}

// Captures the --json stdout envelope (oclif routes logJson through console.log).
async function captureEnvelope(
  fn: () => Promise<unknown>
): Promise<{ result: unknown; envelope: any }> {
  const writes: string[] = [];
  const spy = vi
    .spyOn(console, 'log')
    .mockImplementation((...args: unknown[]) => void writes.push(args.map(String).join(' ')));
  try {
    const result = await fn();
    return { result, envelope: JSON.parse(writes.join('\n').trim()) };
  } finally {
    spy.mockRestore();
  }
}

describe('fetch command branch coverage', () => {
  let dataHome: string;
  let configHome: string;
  let workCwd: string;
  let prevCwd: string;
  let prevExitCode: typeof process.exitCode;
  const prevEnv = {
    XDG_DATA_HOME: process.env.XDG_DATA_HOME,
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
  };

  beforeEach(() => {
    dataHome = mkdtempSync(join(tmpdir(), 'fnr-data-'));
    configHome = mkdtempSync(join(tmpdir(), 'fnr-config-'));
    workCwd = mkdtempSync(join(tmpdir(), 'fnr-cwd-'));
    // oclif's Config reads XDG_* at load time to derive dataDir/configDir; point them at temp dirs
    // so the global cache and config live in isolated throwaway space, never the user's home.
    process.env.XDG_DATA_HOME = dataHome;
    process.env.XDG_CONFIG_HOME = configHome;
    prevCwd = process.cwd();
    process.chdir(workCwd);
    prevExitCode = process.exitCode;

    // Default: no custom site module. Individual tests override detectSite when needed.
    mocks.detectSite.mockReturnValue(undefined);
    mocks.getSiteModuleById.mockReturnValue(undefined);
  });

  afterEach(() => {
    process.chdir(prevCwd);
    process.exitCode = prevExitCode;
    for (const [key, val] of Object.entries(prevEnv)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
    vi.resetAllMocks();
    vi.restoreAllMocks();
    rmSync(dataHome, { recursive: true, force: true });
    rmSync(configHome, { recursive: true, force: true });
    rmSync(workCwd, { recursive: true, force: true });
  });

  // The oclif global data dir the command will use. Under vitest Config.load resolves from oclif's
  // own dir (no project root), so this is derived rather than hardcoded — it loads Config the same
  // way the command does, after XDG_DATA_HOME is pointed at the temp dir. storage.writeArtifact
  // appends research/, so the artifact file lives at <dataDir>/research/<key>.md.
  async function globalDataDir(): Promise<string> {
    // Load Config with no root, exactly as FetchCommand.run([]) does internally — under vitest this
    // resolves from oclif's own dir, so it yields the same dataDir the command uses. Deriving it
    // (rather than hardcoding) keeps the seed dir in lockstep with the command's real cache dir.
    return (await Config.load()).dataDir;
  }

  it('cache MISS: fetches fresh, writes the artifact, returns miss/none', async () => {
    mocks.capturePage.mockResolvedValue(fakeCapture(LONG_MARKDOWN));

    const result: any = await FetchCommand.run([TEST_URL]);

    expect(mocks.capturePage).toHaveBeenCalledTimes(1);
    expect(result.cache.status).toBe('miss');
    // No prior entry existed, so freshness is 'none' — not 'stale_expired' (nothing expired; the
    // page was simply uncached and is now freshly fetched).
    expect(result.cache.freshness).toBe('none');
    expect(result.cache.redirectedToGlobal).toBe(false);
    expect(result.format).toBe('compressed');
    expect(result.content.length).toBeGreaterThan(0);
    // The artifact was persisted to the global cache and can be read back.
    expect(existsSync(getArtifactPath(await globalDataDir(), result.cache.key))).toBe(true);
  });

  it('cache HIT fresh: serves from cache without fetching', async () => {
    seedCachedArtifact(await globalDataDir(), new Date());

    const result: any = await FetchCommand.run([TEST_URL]);

    expect(mocks.capturePage).not.toHaveBeenCalled();
    expect(mocks.fetchStaticHtml).not.toHaveBeenCalled();
    expect(result.cache.status).toBe('hit');
    expect(result.cache.freshness).toBe('fresh');
  });

  it('stale revalidation 304: revalidates from cache via conditional request', async () => {
    // standard tier: fresh 30d, grace 14d. 40d old => stale_grace, triggering revalidation.
    seedCachedArtifact(await globalDataDir(), new Date(Date.now() - 40 * 24 * 3600 * 1000));
    mocks.fetchStaticHtml.mockResolvedValue(fakeFetchResult({ status: 304, content: '' }));

    const result: any = await FetchCommand.run([TEST_URL]);

    expect(mocks.fetchStaticHtml).toHaveBeenCalledTimes(1);
    expect(result.cache.status).toBe('revalidated');
  });

  it('stale revalidation 200: refetches and refreshes the artifact', async () => {
    seedCachedArtifact(await globalDataDir(), new Date(Date.now() - 40 * 24 * 3600 * 1000));
    mocks.fetchStaticHtml.mockResolvedValue(fakeFetchResult({ status: 200 }));

    const result: any = await FetchCommand.run([TEST_URL]);

    expect(result.cache.status).toBe('refreshed');
  });

  it('stale revalidation failure within grace + --allow-stale: serves stale (allowed, no exit 5)', async () => {
    seedCachedArtifact(await globalDataDir(), new Date(Date.now() - 40 * 24 * 3600 * 1000));
    mocks.fetchStaticHtml.mockRejectedValue(new Error('network down'));

    const result: any = await FetchCommand.run([TEST_URL, '--allow-stale']);

    expect(result.cache.status).toBe('stale');
    // allowed => process.exitCode is NOT set to 5
    expect(process.exitCode).not.toBe(5);
  });

  it('stale revalidation failure within grace (no --allow-stale): serves stale and sets exit 5', async () => {
    seedCachedArtifact(await globalDataDir(), new Date(Date.now() - 40 * 24 * 3600 * 1000));
    mocks.fetchStaticHtml.mockRejectedValue(new Error('network down'));

    const result: any = await FetchCommand.run([TEST_URL]);

    expect(result.cache.status).toBe('stale');
    expect(process.exitCode).toBe(5);
  });

  it('stale beyond grace + revalidation failure: rejects (non-json mode)', async () => {
    // 200d old, standard tier (fresh 30d + grace 14d) => stale_expired, no grace serving.
    seedCachedArtifact(await globalDataDir(), new Date(Date.now() - 200 * 24 * 3600 * 1000));
    mocks.fetchStaticHtml.mockRejectedValue(new Error('network down'));

    await expect(FetchCommand.run([TEST_URL])).rejects.toThrow(/Revalidation failed/);
  });

  it('--dry-run: fetches but never writes to the cache and cleans up the temp dir', async () => {
    mocks.capturePage.mockResolvedValue(fakeCapture(LONG_MARKDOWN));

    const result: any = await FetchCommand.run([TEST_URL, '--dry-run']);

    expect(result.cache.status).toBe('miss');
    expect(result.cache.freshness).toBe('none');
    // No artifact persisted to the real cache.
    expect(existsSync(getArtifactPath(await globalDataDir(), result.cache.key))).toBe(false);
    // No stray fnr-dry-run-* temp dirs left behind.
    const leftover = readdirSync(tmpdir()).filter((n) => n.startsWith('fnr-dry-run-'));
    expect(leftover).toHaveLength(0);
  });

  it('--force: ignores a fresh cache entry and refetches (lookup disabled)', async () => {
    seedCachedArtifact(await globalDataDir(), new Date());
    mocks.capturePage.mockResolvedValue(fakeCapture(LONG_MARKDOWN));

    const result: any = await FetchCommand.run([TEST_URL, '--force']);

    expect(mocks.capturePage).toHaveBeenCalledTimes(1);
    expect(result.cache.status).toBe('miss');
    // --force disables lookup, so the existing fresh entry is ignored and the path behaves like a
    // cold miss: no prior entry was consulted, hence freshness 'none'.
    expect(result.cache.freshness).toBe('none');
  });

  it('--max-age expiry: a tier-fresh entry is forced stale and revalidated', async () => {
    // 2 days old: fresh by the standard tier policy, but --max-age 1d marks it expired
    // (checkMaxAgeExpired's true branch). The command reports stale_expired and runs revalidation;
    // a 304 lets it revalidate in place rather than refetch the body.
    seedCachedArtifact(await globalDataDir(), new Date(Date.now() - 2 * 24 * 3600 * 1000));
    mocks.fetchStaticHtml.mockResolvedValue(fakeFetchResult({ status: 304 }));

    const result: any = await FetchCommand.run([TEST_URL, '--max-age', '1d']);

    expect(result.cache.freshness).toBe('stale_expired');
    expect(['revalidated', 'refreshed']).toContain(result.cache.status);
  });

  it('invalid TTL: exits with code 2', async () => {
    await expect(FetchCommand.run([TEST_URL, '--ttl', 'not-a-ttl'])).rejects.toMatchObject({
      oclif: { exit: 2 },
    });
    expect(mocks.capturePage).not.toHaveBeenCalled();
  });

  it('invalid max-age: exits with code 2', async () => {
    await expect(FetchCommand.run([TEST_URL, '--max-age', 'bogus'])).rejects.toMatchObject({
      oclif: { exit: 2 },
    });
  });

  it('invalid URL: exits with code 2', async () => {
    await expect(FetchCommand.run(['not-a-valid-url'])).rejects.toMatchObject({
      oclif: { exit: 2 },
    });
  });

  it('--storage project: writes to the project .bonsai cache under cwd', async () => {
    mocks.capturePage.mockResolvedValue(fakeCapture(LONG_MARKDOWN));

    const result: any = await FetchCommand.run([TEST_URL, '--storage', 'project']);

    expect(result.cache.storage).toBe('project');
    expect(result.cache.redirectedToGlobal).toBe(false);
    const projectDir = join(workCwd, '.bonsai');
    expect(existsSync(getArtifactPath(projectDir, result.cache.key))).toBe(true);
  });

  it('secret-redirect: a secret-bearing page under project storage is rerouted to global', async () => {
    // A page whose content carries a credential must never land in a (committable) project cache.
    const secretMarkdown = 'config\n\nAKIAIOSFODNN7EXAMPLE\n\n' + LONG_MARKDOWN;
    mocks.capturePage.mockResolvedValue(fakeCapture(secretMarkdown));

    const result: any = await FetchCommand.run([TEST_URL, '--storage', 'project']);

    expect(result.cache.redirectedToGlobal).toBe(true);
    // Stored in global, not the project dir.
    expect(existsSync(getArtifactPath(await globalDataDir(), result.cache.key))).toBe(true);
    expect(existsSync(getArtifactPath(join(workCwd, '.bonsai'), result.cache.key))).toBe(false);
  });

  it('--format detailed: returns the detailed body and detailed token estimate', async () => {
    mocks.capturePage.mockResolvedValue(fakeCapture(LONG_MARKDOWN));

    const result: any = await FetchCommand.run([TEST_URL, '--format', 'detailed']);

    expect(result.format).toBe('detailed');
    expect(result.content).toContain('useful paragraph');
  });

  it('--rendered: forces the browser-rendered capture path', async () => {
    mocks.capturePage.mockResolvedValue(
      fakeCapture(LONG_MARKDOWN, { captureMethod: 'browser_fallback' })
    );

    const result: any = await FetchCommand.run([TEST_URL, '--rendered']);

    // forceRendered is passed through to capturePage.
    expect(mocks.capturePage).toHaveBeenCalledWith(
      normalizeUrl(TEST_URL),
      expect.objectContaining({ forceRendered: true }),
      expect.anything()
    );
    expect(result.source.captureMethod).toBe('browser_fallback');
  });

  it('site module fetchPage: uses the custom fetch strategy, not capturePage', async () => {
    const fetchPage = vi.fn().mockResolvedValue({
      fetchResult: fakeFetchResult(),
      extraction: fakeExtraction(LONG_MARKDOWN),
    });
    mocks.detectSite.mockReturnValue({
      id: 'react',
      name: 'React',
      domains: ['docs.example.com'],
      fetchPage,
    });

    const result: any = await FetchCommand.run([TEST_URL]);

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(mocks.capturePage).not.toHaveBeenCalled();
    expect(result.cache.status).toBe('miss');
  });

  it('--json: returns the data object and prints the success envelope', async () => {
    mocks.capturePage.mockResolvedValue(fakeCapture(LONG_MARKDOWN));

    const { result, envelope } = await captureEnvelope(() =>
      FetchCommand.run([TEST_URL, '--json'])
    );

    expect(result).toHaveProperty('schemaVersion', 1);
    expect(envelope).toMatchObject({ schemaVersion: 1, ok: true, exitCode: 0 });
    expect(envelope.data).toHaveProperty('cache.status', 'miss');
  });

  it('--json served-stale: envelope reports exitCode 5 and ok=true', async () => {
    seedCachedArtifact(await globalDataDir(), new Date(Date.now() - 40 * 24 * 3600 * 1000));
    mocks.fetchStaticHtml.mockRejectedValue(new Error('network down'));

    const { envelope } = await captureEnvelope(() => FetchCommand.run([TEST_URL, '--json']));

    expect(envelope).toMatchObject({ ok: true, exitCode: 5 });
    expect(envelope.data.cache.status).toBe('stale');
  });
});
