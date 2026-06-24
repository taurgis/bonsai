import { describe, it, expect } from 'vitest';
import { detectSecret, scanArtifactForSecret } from './secret-scan.js';
import type { ResearchArtifact } from './schema.js';

describe('detectSecret', () => {
  it('flags common credential formats by type, never echoing the value', () => {
    expect(detectSecret('AKIAIOSFODNN7EXAMPLE')).toBe('AWS access key id');
    expect(detectSecret('token ghp_' + 'a'.repeat(36))).toBe('GitHub token');
    expect(detectSecret('github_pat_' + 'B'.repeat(82))).toBe('GitHub fine-grained PAT');
    expect(detectSecret('use sk-' + 'x'.repeat(32))).toBe('OpenAI/Anthropic-style API key');
    expect(detectSecret('Authorization: Bearer ' + 'y'.repeat(30))).toBe('Bearer token');
    expect(detectSecret('api_key = "abcdef0123456789ABCDEF"')).toBe('credential assignment');
    expect(detectSecret('-----BEGIN RSA PRIVATE KEY-----')).toBe('Private key block');
  });

  it('returns null for ordinary documentation prose', () => {
    expect(detectSecret('Install the package and import the client.')).toBeNull();
    expect(detectSecret('Set your API key in the dashboard settings.')).toBeNull();
  });
});

describe('scanArtifactForSecret', () => {
  const artifact = (over: Partial<ResearchArtifact>): ResearchArtifact =>
    ({
      metadata: {} as ResearchArtifact['metadata'],
      summary: 'summary',
      compressed: 'compressed',
      detailed: 'detailed',
      provenance: 'provenance',
      ...over,
    }) as ResearchArtifact;

  it('scans every content field', () => {
    expect(scanArtifactForSecret(artifact({ detailed: 'secret: ' + 'z'.repeat(20) }))).toBe(
      'credential assignment'
    );
    expect(scanArtifactForSecret(artifact({}))).toBeNull();
  });
});
