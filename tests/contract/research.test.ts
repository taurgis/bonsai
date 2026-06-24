import { describe, it, expect } from 'vitest';
import { runContract } from './runner.ts';

describe('research contract tests', () => {
  it('research --help exits 0 and prints help description', () => {
    const result = runContract(['research', '--help']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('An advanced, locally cached web research tool');
  });

  it('research without URL argument fails with exit code 2 (usage error)', () => {
    const result = runContract(['research']);
    expect(result.exitCode).toBe(2);
  });

  it('research with invalid flag value fails with exit code 2 (usage error)', () => {
    const result = runContract(['research', 'https://example.com', '--format', 'invalid-format']);
    expect(result.exitCode).toBe(2);
  });

  it('research URL outputs mock content in human mode', () => {
    const result = runContract(['research', 'https://example.com']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('This domain is for use in documentation examples');
  });

  it('research URL --json outputs structured JSON envelope', () => {
    const result = runContract(['research', 'https://example.com', '--json'], { raw: true });
    expect(result.exitCode).toBe(0);

    const envelope = JSON.parse(result.stdout);
    expect(envelope).toEqual({
      schemaVersion: 1,
      command: 'research',
      ok: true,
      exitCode: 0,
      stdout: '',
      stderr: '',
      data: {
        schemaVersion: 1,
        command: 'research',
        cache: {
          key: '0f115db062b7c0dd030b16878c99dea5c354b49dc37b38eb8846179c7783e9d7',
          status: expect.any(String),
          freshness: expect.any(String),
          path: expect.any(String),
        },
        source: {
          url: 'https://example.com',
          normalizedUrl: 'https://example.com/',
          captureMethod: 'static_fetch',
          extractionStatus: 'extracted',
          extractionConfidence: expect.any(String),
          qualityNotes: expect.any(Array),
          fetchedAt: expect.any(String),
          validatedAt: expect.any(String),
          staleAfter: expect.any(String),
        },
        format: 'compressed',
        tokenEstimate: expect.any(Number),
        content: expect.stringContaining('This domain is for use in documentation examples'),
      },
    });
  });
});
