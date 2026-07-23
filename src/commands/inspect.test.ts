import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import { Config } from '@oclif/core';
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

  it('tips toward status on a cache hit in human mode, and suppresses it under --json', async () => {
    const bin = (await Config.load()).bin;

    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValue('# Inspect Tip Notes');
    await ResearchImport.run(['https://example.com/inspect-tip', '--stdin']);
    readSpy.mockRestore();

    const warnSpy = vi.spyOn(ResearchInspect.prototype as any, 'warn').mockImplementation(() => '');
    try {
      await ResearchInspect.run(['https://example.com/inspect-tip']);
      expect(warnSpy.mock.calls.map((c) => String(c[0]))).toEqual([
        `Tip: ${bin} status https://example.com/inspect-tip to check freshness.`,
      ]);

      warnSpy.mockClear();
      await ResearchInspect.run(['https://example.com/inspect-tip', '--json']);
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
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

  it('strips ANSI escape codes from topic and section headings before printing them', async () => {
    const esc = String.fromCharCode(27);
    const injectedTopic = `${esc}[31mRED${esc}[0m`;
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValue('# ANSI Parent');
    const imp = (await ResearchImport.run([
      'https://example.com/cached-inspect-ansi',
      '--stdin',
      '--topic',
      injectedTopic,
    ])) as any;

    // A section heading is derived from fetched page content (untrusted), so it needs the same
    // sanitization as an explicitly-flagged topic — exercise both paths in the same test.
    const dataDir = dirname(dirname(imp.cache.path));
    const parentKey = imp.cache.key;
    const parent = readArtifact(dataDir, parentKey);
    const sectionKey = createHash('sha256')
      .update(parentKey + 'ansi-section')
      .digest('hex');
    writeArtifact(dataDir, sectionKey, {
      ...parent,
      metadata: {
        ...parent.metadata,
        cache_key: sectionKey,
        artifact_type: 'section',
        parent_cache_key: parentKey,
        status: 'active',
        section_anchor: `${esc}[31manchor${esc}[0m`,
        section_heading_path: `${esc}[31mHeading${esc}[0m`,
      },
    });

    const logged: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logged.push(args.map(String).join(' '));
    });
    try {
      const result = (await ResearchInspect.run([
        'https://example.com/cached-inspect-ansi',
      ])) as any;
      // Frontmatter serialization strips control characters outright (the cache file is plain text
      // meant to be read directly), so the raw escape byte never survives the round trip through disk.
      expect(result.metadata.topic).toBe('[31mRED[0m');

      const output = logged.join('\n');
      expect(output).not.toContain(esc);
      expect(output).toContain('[31mRED[0m');
      expect(output).toContain('[31mHeading[0m');
      expect(output).toContain('[31manchor[0m');
    } finally {
      logSpy.mockRestore();
      readSpy.mockRestore();
    }
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

  it('flags a miss as part of an existing multi-source note instead of suggesting a duplicate fetch', async () => {
    // Multi-source research_notes key off topic+content, not any one URL (see
    // docs/reference/cache-protocol.md), so a plain URL-keyed lookup always misses for every one
    // of their source URLs even though the content already exists.
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValue('# Multi-source inspect note');
    const imported = (await ResearchImport.run([
      '--stdin',
      '--topic',
      'InspectMultiSource',
      '--source-url',
      'https://example.com/inspect-multi-a',
      '--source-url',
      'https://example.com/inspect-multi-b',
    ])) as any;

    const prevExit = process.exitCode;
    process.exitCode = 0;
    try {
      const result = (await ResearchInspect.run(['https://example.com/inspect-multi-b'])) as any;
      expect(result.status).toBe('miss');
      expect(result.partOfExistingNote).toMatchObject({
        cacheKey: imported.cache.key,
        artifactType: 'research_note',
        topic: 'InspectMultiSource',
      });
      expect(result.partOfExistingNote.sourceUrls).toContain('https://example.com/inspect-multi-b');
    } finally {
      process.exitCode = prevExit;
      readSpy.mockRestore();
    }
  });

  it('leaves partOfExistingNote null for a genuinely uncached URL', async () => {
    const prevExit = process.exitCode;
    process.exitCode = 0;
    try {
      const result = (await ResearchInspect.run([
        'https://example.com/truly-never-cached-inspect',
      ])) as any;
      expect(result.status).toBe('miss');
      expect(result.partOfExistingNote).toBeNull();
    } finally {
      process.exitCode = prevExit;
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
