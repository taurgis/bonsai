import { describe, expect, it } from 'vitest';
import { commonMetadataFilterFlags } from './common-metadata-filter-flags.js';

describe('commonMetadataFilterFlags', () => {
  it('exposes the shared topic/tags/url/freshness/artifact-type/capture-method flags', () => {
    const flags = commonMetadataFilterFlags('artifact type description');
    expect(Object.keys(flags).sort()).toEqual(
      ['topic', 'tags', 'url', 'freshness', 'artifact-type', 'capture-method'].sort()
    );
  });

  it('uses the caller-supplied description for --artifact-type', () => {
    const flags = commonMetadataFilterFlags('custom description for this command');
    expect(flags['artifact-type'].description).toBe('custom description for this command');
  });

  it('omits `section` from the --artifact-type options (page-level only)', () => {
    const flags = commonMetadataFilterFlags('artifact type description');
    expect(flags['artifact-type'].options).not.toContain('section');
  });
});
