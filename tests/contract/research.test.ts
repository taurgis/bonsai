import { describe, it, expect } from 'vitest';
import { runContract } from './runner.ts';

describe('research contract tests', () => {
  it('bonsai --help exits 0 and lists top-level commands', () => {
    const result = runContract(['--help']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('COMMANDS');
    expect(result.stdout).toContain('import');
    expect(result.stdout).toContain('search');
    expect(result.stdout).toContain('config');
  });

  it('bonsai help exits 0 and lists top-level commands', () => {
    const result = runContract(['help']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('COMMANDS');
    expect(result.stdout).toContain('import');
  });

  it('bonsai without URL argument exits 0 and lists top-level commands', () => {
    const result = runContract([]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('COMMANDS');
  });

  it('bonsai with invalid flag value fails with exit code 2 (usage error)', () => {
    const result = runContract(['https://example.com', '--format', 'invalid-format']);
    expect(result.exitCode).toBe(2);
  });

  it('bonsai URL outputs mock content in human mode', () => {
    const result = runContract(['https://example.com']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('This domain is for use in documentation examples');
  });

  it('bonsai URL --json outputs structured JSON envelope', () => {
    const result = runContract(['https://example.com', '--json'], { raw: true });
    expect(result.exitCode).toBe(0);

    const envelope = JSON.parse(result.stdout);
    expect(envelope).toEqual({
      schemaVersion: 1,
      command: 'bonsai',
      ok: true,
      exitCode: 0,
      stdout: '',
      stderr: '',
      data: {
        schemaVersion: 1,
        command: 'bonsai',
        cache: {
          key: '0f115db062b7c0dd030b16878c99dea5c354b49dc37b38eb8846179c7783e9d7',
          status: expect.any(String),
          freshness: expect.any(String),
          path: expect.any(String),
          storage: expect.any(String),
          redirectedToGlobal: false,
        },
        source: {
          url: 'https://example.com',
          normalizedUrl: 'https://example.com/',
          // Capture method depends on live fetch + content-length heuristics (short pages fall back
          // to browser rendering), so assert shape not a fixed value — matching the sibling fields.
          captureMethod: expect.any(String),
          extractionStatus: 'extracted',
          extractionConfidence: expect.any(String),
          qualityNotes: expect.any(Array),
          fetchedAt: expect.any(String),
          validatedAt: expect.any(String),
          staleAfter: expect.any(String),
        },
        artifactType: expect.any(String),
        docsEngine: null,
        docsFramework: null,
        sourceDocUrl: null,
        searchProvider: null,
        format: 'compressed',
        tokenEstimate: expect.any(Number),
        content: expect.stringContaining('This domain is for use in documentation examples'),
      },
    });
  });
});
