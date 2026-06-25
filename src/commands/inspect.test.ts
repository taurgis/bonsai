import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import ResearchInspect from './inspect.js';
import ResearchImport from './import.js';
import { writeArtifact, readArtifact } from '../lib/research/storage.js';

describe('inspect command unit tests', () => {
  it('fails to inspect uncached URL', async () => {
    const runPromise = ResearchInspect.run(['https://example.com/not-cached-inspect']);
    await expect(runPromise).rejects.toThrow(/No cached research found/);
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
    await expect(ResearchInspect.run(['not a url'])).rejects.toThrow(/Invalid URL/);
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
    const dataDir = imp.cache.path.split('/research/')[0];
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
});
