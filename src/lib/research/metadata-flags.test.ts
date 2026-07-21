import { describe, it, expect } from 'vitest';
import { metadataNewlineError } from './metadata-flags.js';

describe('metadataNewlineError', () => {
  it('returns null when topic and tags are absent or clean', () => {
    expect(metadataNewlineError({})).toBeNull();
    expect(metadataNewlineError({ topic: 'Clean topic', tags: ['clean', 'tags'] })).toBeNull();
  });

  it('flags a topic containing a newline', () => {
    expect(metadataNewlineError({ topic: 'line1\nline2' })).toBe(
      '--topic cannot contain line breaks.'
    );
  });

  it('flags a topic containing a bare carriage return', () => {
    expect(metadataNewlineError({ topic: 'line1\rline2' })).toBe(
      '--topic cannot contain line breaks.'
    );
  });

  it('flags any tag containing a newline, even when earlier tags are clean', () => {
    expect(metadataNewlineError({ tags: ['clean', 'dirty\ntag'] })).toBe(
      '--tags cannot contain line breaks.'
    );
  });

  it('checks topic before tags when both are present and clean', () => {
    expect(metadataNewlineError({ topic: 'Clean', tags: ['clean'] })).toBeNull();
  });
});
