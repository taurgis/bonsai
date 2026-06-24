import { describe, it, expect, vi, beforeEach } from 'vitest';
import ResearchList from './list.js';
import ResearchImport from './import.js';

describe('research list command unit tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('lists and filters cached items successfully using seeded data', async () => {
    const readSpy = vi
      .spyOn(ResearchImport.prototype as any, 'readStdin')
      .mockResolvedValueOnce('# React Suspense Cache Docs\nThis is about React Suspense.')
      .mockResolvedValueOnce('# Node Streams Guide\nThis is about Node streams.')
      .mockResolvedValueOnce('# Volatile Release Notes\nThis is a volatile release.');

    // Seed 3 entries
    await ResearchImport.run([
      'https://example.com/react-list-test',
      '--stdin',
      '--topic',
      'React List Cache',
      '--tags',
      'react',
      '--tags',
      'web',
    ]);
    await ResearchImport.run([
      'https://example.com/node-list-test',
      '--stdin',
      '--topic',
      'Node Streams',
      '--tags',
      'node',
      '--tags',
      'backend',
    ]);
    await ResearchImport.run([
      'https://example.com/volatile-list-test',
      '--stdin',
      '--topic',
      'Changelog',
      '--tags',
      'release',
      '--tier',
      'volatile',
    ]);

    // 1. List all entries
    const listAll = (await ResearchList.run([])) as any[];
    expect(listAll).toBeDefined();
    expect(listAll.length).toBeGreaterThanOrEqual(3);

    const reactItem = listAll.find((x) => x.topic === 'React List Cache');
    expect(reactItem).toBeDefined();
    expect(reactItem.artifactType).toBe('source');
    expect(reactItem.tags).toContain('react');

    // 2. Filter by topic
    const listTopic = (await ResearchList.run(['--topic', 'React List Cache'])) as any[];
    expect(listTopic.length).toBeGreaterThanOrEqual(1);
    expect(listTopic.every((x) => x.topic === 'React List Cache')).toBe(true);

    // 3. Filter by tags
    const listTags = (await ResearchList.run(['--tags', 'node'])) as any[];
    expect(listTags.length).toBeGreaterThanOrEqual(1);
    expect(listTags.every((x) => x.tags.includes('node'))).toBe(true);

    // 4. Filter by capture method
    const listMethod = (await ResearchList.run(['--capture-method', 'agent_supplied'])) as any[];
    expect(listMethod.length).toBeGreaterThanOrEqual(3);

    readSpy.mockRestore();
  });

  it('fails if limit is out of bounds', async () => {
    const runPromise = ResearchList.run(['--limit', '200']);
    await expect(runPromise).rejects.toThrow(/Limit must be between 1 and 100/);
  });
});
