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

  it('flags UPPER_SNAKE env-var credential assignments where the keyword is embedded', () => {
    // The literal AWS secret has no fixed prefix, so it is only caught via the assignment form.
    expect(detectSecret('export AWS_SECRET_ACCESS_KEY=' + 'w'.repeat(40))).toBe(
      'credential assignment'
    );
    expect(detectSecret('DB_PASSWORD=' + 's'.repeat(20))).toBe('credential assignment');
    expect(detectSecret('MY_ACCESS_TOKEN=' + 'b'.repeat(20))).toBe('credential assignment');
    // Intentional scope: the keyword may also be prefixed by an underscore or digit (e.g. `_SECRET`,
    // `SESSION1_TOKEN`), which are plausible env-var names the broadened boundary deliberately catches.
    expect(detectSecret('_SECRET=' + 'a'.repeat(20))).toBe('credential assignment');
    expect(detectSecret('1TOKEN=' + 'c'.repeat(20))).toBe('credential assignment');
  });

  it('returns null for ordinary documentation prose', () => {
    expect(detectSecret('Install the package and import the client.')).toBeNull();
    expect(detectSecret('Set your API key in the dashboard settings.')).toBeNull();
    expect(detectSecret('The token endpoint: https://example.com/oauth/authorize')).toBeNull();
    expect(detectSecret('| access_token | string | required |')).toBeNull();
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
