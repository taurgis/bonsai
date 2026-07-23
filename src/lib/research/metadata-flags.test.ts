import { describe, it, expect } from 'vitest';
import {
  MAX_TAG_LENGTH,
  MAX_TOPIC_LENGTH,
  metadataLengthError,
  metadataNewlineError,
} from './metadata-flags.js';

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

  it('checks topic before tags when both are dirty', () => {
    expect(metadataNewlineError({ topic: 'bad\nbreak', tags: ['also\nbad'] })).toBe(
      '--topic cannot contain line breaks.'
    );
  });
});

describe('metadataLengthError', () => {
  it('returns null when topic and tags are absent or within the cap', () => {
    expect(metadataLengthError({})).toBeNull();
    expect(
      metadataLengthError({
        topic: 'a'.repeat(MAX_TOPIC_LENGTH),
        tags: ['b'.repeat(MAX_TAG_LENGTH)],
      })
    ).toBeNull();
  });

  it('flags a topic over the length cap', () => {
    const topic = 'a'.repeat(MAX_TOPIC_LENGTH + 1);
    expect(metadataLengthError({ topic })).toBe(
      `--topic must be ${MAX_TOPIC_LENGTH} characters or fewer (got ${MAX_TOPIC_LENGTH + 1}).`
    );
  });

  it('flags any tag over the length cap, even when earlier tags fit', () => {
    const longTag = 'b'.repeat(MAX_TAG_LENGTH + 1);
    expect(metadataLengthError({ tags: ['short', longTag] })).toBe(
      `--tags must be ${MAX_TAG_LENGTH} characters or fewer (got ${MAX_TAG_LENGTH + 1}).`
    );
  });

  it('checks topic before tags when both are over the cap', () => {
    expect(
      metadataLengthError({
        topic: 'a'.repeat(MAX_TOPIC_LENGTH + 1),
        tags: ['b'.repeat(MAX_TAG_LENGTH + 1)],
      })
    ).toBe(
      `--topic must be ${MAX_TOPIC_LENGTH} characters or fewer (got ${MAX_TOPIC_LENGTH + 1}).`
    );
  });
});
