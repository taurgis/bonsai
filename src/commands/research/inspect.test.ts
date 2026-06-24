import { describe, it, expect, vi } from 'vitest';
import ResearchInspect from './inspect.js';
import ResearchImport from './import.js';

describe('research inspect command unit tests', () => {
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
});
