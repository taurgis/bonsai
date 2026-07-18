import { Config } from '@oclif/core';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import ResearchInspect from './inspect.js';
import ResearchImport from './import.js';
import { writeArtifact, readArtifact } from '../lib/research/storage.js';
import { useIsolatedCache } from '../../tests/helpers/isolated-cache.js';

describe('inspect command unit tests', () => {
  useIsolatedCache();

  it('reports a structured miss for an uncached URL without discarding the payload shape', async () => {
    const prevExit = process.exitCode;
    process.exitCode = 0;
    try {
      const result = (await ResearchInspect.run(['https://example.com/not-cached-inspect'])) as any;
      expect(result.status).toBe('miss');
      expect(result.metadata).toBeNull();
      expect(result.normalizedUrl).toBe('https://example.com/not-cached-inspect');
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = prevExit;
    }
  });

  it('inspects cached URL successfully', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValue('# Inspect Payload');

    await ResearchImport.run([
      'https://example.com/cached-inspect',
      '--stdin',
      '--topic',
      'My Inspect Topic',
    ]);

    const result = (await ResearchInspect.run(['https://example.com/cached-inspect'])) as any;
    expect(result).toBeDefined();
    expect(result.metadata.topic).toBe('My Inspect Topic');
    expect(result.metadata.artifact_type).toBe('source');

    readSpy.mockRestore();
  });

  it('rejects an invalid URL with exit 2', async () => {
    await expect(ResearchInspect.run(['not a url'])).rejects.toThrow(
      /Invalid URL: Could not parse/
    );
  });

  it('returns metadata in --json mode without logging it', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValue('# JSON Inspect');
    await ResearchImport.run([
      'https://example.com/cached-inspect-json',
      '--stdin',
      '--topic',
      'JsonInspect',
    ]);

    const result = (await ResearchInspect.run([
      'https://example.com/cached-inspect-json',
      '--json',
    ])) as any;
    expect(result.metadata.topic).toBe('JsonInspect');

    readSpy.mockRestore();
  });

  it('lists active section children of the inspected page', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValue('# Section Parent');
    const imp = (await ResearchImport.run([
      'https://example.com/cached-inspect-sections',
      '--stdin',
      '--topic',
      'SectionParent',
    ])) as any;

    // Clone the (valid) parent artifact into a section child so inspect's findSections returns it.
    const dataDir = dirname(dirname(imp.cache.path));
    const parentKey = imp.cache.key;
    const parent = readArtifact(dataDir, parentKey);
    const sectionKey = createHash('sha256')
      .update(parentKey + 'section')
      .digest('hex');
    writeArtifact(dataDir, sectionKey, {
      ...parent,
      metadata: {
        ...parent.metadata,
        cache_key: sectionKey,
        artifact_type: 'section',
        parent_cache_key: parentKey,
        status: 'active',
        section_anchor: 'intro',
        section_heading_path: 'Intro > Overview',
      },
    });

    const result = (await ResearchInspect.run([
      'https://example.com/cached-inspect-sections',
    ])) as any;
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].headingPath).toBe('Intro > Overview');
    expect(result.sections[0].anchor).toBe('intro');

    readSpy.mockRestore();
  });

  it('keeps cached inspect rows when another URL misses in the same batch', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValue('# Inspect Batch Hit');
    const hitUrl = 'https://example.com/cached-inspect-batch-hit';
    const missUrl = 'https://example.com/not-cached-inspect-batch-miss';
    const prevExit = process.exitCode;
    process.exitCode = 0;

    try {
      await ResearchImport.run([hitUrl, '--stdin', '--topic', 'InspectBatchHit']);

      const result = (await ResearchInspect.run([hitUrl, missUrl])) as any[];
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        status: 'hit',
        normalizedUrl: hitUrl,
        metadata: { topic: 'InspectBatchHit' },
      });
      expect(result[1]).toMatchObject({
        status: 'miss',
        normalizedUrl: missUrl,
        metadata: null,
        sections: [],
      });
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = prevExit;
      readSpy.mockRestore();
    }
  });

  it('keeps cached inspect rows when another URL fails validation in the same batch', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValue('# Inspect Batch Invalid');
    const hitUrl = 'https://example.com/cached-inspect-batch-invalid';
    const prevExit = process.exitCode;
    process.exitCode = 0;

    try {
      await ResearchImport.run([hitUrl, '--stdin', '--topic', 'InspectBatchInvalid']);

      const result = (await ResearchInspect.run([hitUrl, 'not a url'])) as any[];
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        status: 'hit',
        normalizedUrl: hitUrl,
        metadata: { topic: 'InspectBatchInvalid' },
      });
      expect(result[1]).toMatchObject({
        status: 'error',
        normalizedUrl: 'not a url',
        error: { code: 'INVALID_URL' },
      });
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = prevExit;
      readSpy.mockRestore();
    }
  });
});

describe('inspect JSON envelope shaping', () => {
  async function instance() {
    const config = await Config.load(process.cwd());
    return new ResearchInspect([], config) as any;
  }

  beforeEach(() => {
    process.exitCode = undefined;
  });

  it('adds CACHE_MISS code and suggestions when inspect data is a miss', async () => {
    const cmd = await instance();
    const prev = process.exitCode;
    process.exitCode = 1;
    try {
      const envelope = cmd.toSuccessJson({
        status: 'miss',
        normalizedUrl: 'https://example.com/missing-inspect',
        cacheKey: 'abc',
        cachePath: '/tmp/x.md',
        metadata: null,
        sections: [],
      });
      expect(envelope).toMatchObject({
        ok: false,
        exitCode: 1,
        code: 'CACHE_MISS',
      });
      expect(envelope.stderr).toContain('Code: CACHE_MISS');
      expect(envelope.suggestions?.[0]).toContain('Fetch and cache it first');
    } finally {
      process.exitCode = prev;
    }
  });

  it('passes through inspect hit envelopes unchanged', async () => {
    const cmd = await instance();
    const envelope = cmd.toSuccessJson({
      status: 'hit',
      normalizedUrl: 'https://example.com/cached-inspect',
      metadata: { topic: 'Cached inspect' },
      sections: [],
    });
    expect(envelope).toMatchObject({ ok: true, exitCode: 0, stderr: '' });
    expect(envelope.code).toBeUndefined();
  });

  it('prefers row validation errors over CACHE_MISS when inspect batch data has both', async () => {
    const cmd = await instance();
    const prev = process.exitCode;
    process.exitCode = 1;
    try {
      const envelope = cmd.toSuccessJson([
        {
          status: 'miss',
          normalizedUrl: 'https://example.com/missing-inspect',
          metadata: null,
          sections: [],
        },
        {
          status: 'error',
          normalizedUrl: 'not-a-url',
          error: { code: 'INVALID_URL', message: 'Invalid URL: not-a-url' },
        },
      ]);
      expect(envelope).toMatchObject({
        ok: false,
        exitCode: 1,
        code: 'INVALID_URL',
      });
      expect(envelope.stderr).toContain('INVALID_URL');
      expect(Array.isArray(envelope.data)).toBe(true);
    } finally {
      process.exitCode = prev;
    }
  });
});
