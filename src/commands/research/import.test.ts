import { describe, it, expect, vi } from 'vitest';
import ResearchImport from './import.js';

describe('research import command unit tests', () => {
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

  it('fails if stdin flag is missing', async () => {
    const runPromise = ResearchImport.run(['https://example.com']);
    await expect(runPromise).rejects.toThrow(/The --stdin flag must be specified/);
  });

  it('fails if empty content is read from stdin', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValue('   \n  ');

    const runPromise = ResearchImport.run(['https://example.com', '--stdin']);
    await expect(runPromise).rejects.toThrow(/Empty stdin content/);

    readSpy.mockRestore();
  });
});
