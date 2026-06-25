import { describe, it, expect, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import ResearchImport from './import.js';

describe('import command unit tests', () => {
  it('successfully imports single-source markdown content', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValue('## Header\nMy detailed notes');

    const result = (await ResearchImport.run([
      'https://example.com/import-test',
      '--stdin',
      '--input-format',
      'detailed',
    ])) as any;

    expect(readSpy).toHaveBeenCalled();
    expect(result).toBeDefined();
    expect(result.schemaVersion).toBe(1);
    expect(result.cache.status).toBe('imported');
    expect(result.cache.freshness).toBe('fresh');
    expect(result.source.url).toBe('https://example.com/import-test');
    expect(result.source.normalizedUrl).toBe('https://example.com/import-test');
    expect(result.content).toBe('## Header\nMy detailed notes');

    readSpy.mockRestore();
  });

  it('successfully imports multi-source markdown content', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValue('Compressed contents');

    const result = (await ResearchImport.run([
      '--stdin',
      '--input-format',
      'compressed',
      '--topic',
      'Multi Import Topic',
      '--source-url',
      'https://example.com/a',
      '--source-url',
      'https://example.com/b',
    ])) as any;

    expect(readSpy).toHaveBeenCalled();
    expect(result).toBeDefined();
    expect(result.schemaVersion).toBe(1);
    expect(result.cache.status).toBe('imported');
    expect(result.source.normalizedUrl).toBe('');
    expect(result.content).toBe('Compressed contents');

    readSpy.mockRestore();
  });

  it('fails if both single and multi-source are specified', async () => {
    const runPromise = ResearchImport.run([
      'https://example.com',
      '--stdin',
      '--source-url',
      'https://example.com/a',
    ]);
    await expect(runPromise).rejects.toThrow(/Cannot specify both/);
  });

  it('fails if neither single nor multi-source are specified', async () => {
    const runPromise = ResearchImport.run(['--stdin']);
    await expect(runPromise).rejects.toThrow(/Must specify either/);
  });

  it('fails if multi-source is specified without topic', async () => {
    const runPromise = ResearchImport.run(['--stdin', '--source-url', 'https://example.com/a']);
    await expect(runPromise).rejects.toThrow(/Multi-source import requires the --topic flag/);
  });

  it('successfully imports markdown content from a file', async () => {
    const existsSpy = vi
      .spyOn(ResearchImport.prototype as any, 'fsExistsSync')
      .mockReturnValue(true);
    const statSpy = vi
      .spyOn(ResearchImport.prototype as any, 'fsStatSync')
      .mockReturnValue({ isFile: () => true, size: 500 } as any);
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'fsReadFileSync')
      .mockReturnValue('## Notes\nFile content notes');

    const result = (await ResearchImport.run([
      'https://example.com/file-import',
      '--file',
      'some-notes.md',
    ])) as any;

    expect(existsSpy).toHaveBeenCalledWith(path.resolve('some-notes.md'));
    expect(result).toBeDefined();
    expect(result.schemaVersion).toBe(1);
    expect(result.cache.status).toBe('imported');
    expect(result.content).toBe('## Notes\nFile content notes');

    existsSpy.mockRestore();
    statSpy.mockRestore();
    readSpy.mockRestore();
  });

  it('fails if both stdin and file flags are missing', async () => {
    const runPromise = ResearchImport.run(['https://example.com']);
    await expect(runPromise).rejects.toThrow(/Either --stdin or --file/);
  });

  it('fails if both stdin and file flags are specified', async () => {
    const runPromise = ResearchImport.run(['https://example.com', '--stdin', '--file', 'notes.md']);
    await expect(runPromise).rejects.toThrow(/Cannot specify both --stdin and --file/);
  });

  it('fails if file does not exist', async () => {
    const existsSpy = vi
      .spyOn(ResearchImport.prototype as any, 'fsExistsSync')
      .mockReturnValue(false);

    const runPromise = ResearchImport.run(['https://example.com', '--file', 'ghost.md']);
    await expect(runPromise).rejects.toThrow(/File does not exist/);

    existsSpy.mockRestore();
  });

  it('fails if empty content is read from stdin', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValue('   \n  ');

    const runPromise = ResearchImport.run(['https://example.com', '--stdin']);
    await expect(runPromise).rejects.toThrow(/Empty stdin content/);

    readSpy.mockRestore();
  });

  it('auto-generates tags and records a quality note when no --tags are supplied', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValue('# Webhooks\nWebhooks deliver events. Webhooks retry on failure.');

    const result = (await ResearchImport.run(['https://example.com/auto-tag', '--stdin'])) as any;

    expect(result.source.qualityNotes).toContain('auto-generated tags via keyword extraction');
    readSpy.mockRestore();
  });

  it('does not auto-tag when explicit --tags are supplied', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValue('# Webhooks\nWebhooks deliver events. Webhooks retry on failure.');

    const result = (await ResearchImport.run([
      'https://example.com/manual-tag',
      '--stdin',
      '--tags',
      'manual',
    ])) as any;

    expect(result.source.qualityNotes).not.toContain('auto-generated tags via keyword extraction');
    readSpy.mockRestore();
  });
});
