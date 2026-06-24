import { describe, it, expect, vi } from 'vitest';
import ResearchSearch from './search.js';
import ResearchImport from './import.js';

describe('research search command unit tests', () => {
  it('fails if query is empty or only whitespace', async () => {
    const runPromise = ResearchSearch.run(['   ']);
    await expect(runPromise).rejects.toThrow(/Query string cannot be empty/);
  });

  it('returns empty results if no match is found', async () => {
    const result = (await ResearchSearch.run(['nonexistentQueryTerm'])) as any[];
    expect(result).toBeDefined();
    expect(result).toHaveLength(0);
  });

  it('finds and ranks matching cached research', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValueOnce(
        '# React Suspense Cache Docs\nThis is about React Suspense caching patterns.'
      )
      .mockResolvedValueOnce('# Vue Component Design\nThis is about Vue components.');

    // Seed two entries
    await ResearchImport.run([
      'https://example.com/react-search-test',
      '--stdin',
      '--topic',
      'React Cache',
      '--tags',
      'react',
    ]);
    await ResearchImport.run([
      'https://example.com/vue-search-test',
      '--stdin',
      '--topic',
      'Vue Design',
      '--tags',
      'vue',
    ]);

    // Search for "react suspense"
    const results = (await ResearchSearch.run(['react suspense'])) as any[];
    expect(results).toHaveLength(1);
    expect(results[0].topic).toBe('React Cache');
    expect(results[0].score).toBeGreaterThan(0);
    expect(results[0].snippet).toContain('React Suspense');

    readSpy.mockRestore();
  });

  it('filters results by topic and tags', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValueOnce('# Node streams\nDetailed info on Node streams.')
      .mockResolvedValueOnce('# Web streams\nDetailed info on browser/Web streams.');

    await ResearchImport.run([
      'https://example.com/node-streams',
      '--stdin',
      '--topic',
      'Backend Streams',
      '--tags',
      'node',
    ]);
    await ResearchImport.run([
      'https://example.com/web-streams',
      '--stdin',
      '--topic',
      'Frontend Streams',
      '--tags',
      'web',
    ]);

    // Match both but filter by tag "node"
    const results = (await ResearchSearch.run(['streams', '--tags', 'node'])) as any[];
    expect(results).toHaveLength(1);
    expect(results[0].topic).toBe('Backend Streams');

    // Match both but filter by topic Frontend Streams
    const resultsTopic = (await ResearchSearch.run([
      'streams',
      '--topic',
      'Frontend Streams',
    ])) as any[];
    expect(resultsTopic).toHaveLength(1);
    expect(resultsTopic[0].topic).toBe('Frontend Streams');

    readSpy.mockRestore();
  });
});
