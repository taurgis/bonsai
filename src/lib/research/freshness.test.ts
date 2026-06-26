import { describe, it, expect } from 'vitest';
import {
  parseTtlToMs,
  getPolicy,
  evaluateFreshness,
  checkMaxAgeExpired,
  durationFlagError,
} from './freshness.js';
import type { ResearchArtifactMetadata } from './schema.js';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

function meta(over: Partial<ResearchArtifactMetadata> = {}): ResearchArtifactMetadata {
  return {
    schema_version: 1,
    artifact_type: 'source',
    source_url: 'https://example.com/docs',
    source_urls: ['https://example.com/docs'],
    normalized_url: 'https://example.com/docs',
    cache_key: 'abcdef123456',
    topic: null,
    tags: [],
    format_available: ['compressed', 'detailed'],
    tier: 'standard',
    ttl: null,
    fetched_at: '2026-06-01T00:00:00.000Z',
    validated_at: '2026-06-01T00:00:00.000Z',
    stale_after: null,
    capture_method: 'static_fetch',
    extraction_status: 'extracted',
    extraction_confidence: 'high',
    quality_notes: [],
    supplied_at: null,
    supplied_by: null,
    etag: null,
    last_modified: null,
    content_hash: 'sha256-x',
    token_estimate: { compressed: 1, detailed: 1 },
    status: 'active',
    site_module_id: null,
    docs_engine: null,
    docs_framework: null,
    source_doc_url: null,
    search_provider: null,
    parent_cache_key: null,
    section_anchor: null,
    section_heading_path: null,
    ...over,
  };
}

describe('parseTtlToMs', () => {
  it('parses each supported unit', () => {
    expect(parseTtlToMs('24h')).toBe(24 * HOUR);
    expect(parseTtlToMs('7d')).toBe(7 * DAY);
    expect(parseTtlToMs('2w')).toBe(2 * 7 * DAY);
    expect(parseTtlToMs('1m')).toBe(30 * DAY);
    expect(parseTtlToMs('1y')).toBe(365 * DAY);
  });

  it('throws on a malformed TTL string', () => {
    expect(() => parseTtlToMs('soon')).toThrow(/Invalid TTL format/);
    expect(() => parseTtlToMs('10')).toThrow(/Invalid TTL format/);
    expect(() => parseTtlToMs('10s')).toThrow(/Invalid TTL format/);
    expect(() => parseTtlToMs('')).toThrow(/Invalid TTL format/);
  });
});

describe('durationFlagError', () => {
  it('returns null for an absent or valid value', () => {
    expect(durationFlagError('--ttl', undefined)).toBeNull();
    expect(durationFlagError('--ttl', '7d')).toBeNull();
  });

  it('names the offending flag on a malformed value', () => {
    expect(durationFlagError('--ttl', 'banana')).toMatch(/Invalid --ttl:/);
    expect(durationFlagError('--max-age', 'soon')).toMatch(/Invalid --max-age:/);
  });
});

describe('getPolicy', () => {
  it('uses tier defaults for stable, standard, and volatile', () => {
    expect(getPolicy('stable')).toEqual({ freshWindowMs: 180 * DAY, graceWindowMs: 60 * DAY });
    expect(getPolicy('standard')).toEqual({ freshWindowMs: 30 * DAY, graceWindowMs: 14 * DAY });
    expect(getPolicy('volatile')).toEqual({ freshWindowMs: 7 * DAY, graceWindowMs: 5 * DAY });
  });

  it('applies a TTL override and scales grace proportionally per tier', () => {
    // standard default grace/fresh = 14/30; override fresh to 60d => grace = 60 * (14/30) = 28d.
    expect(getPolicy('standard', '60d')).toEqual({
      freshWindowMs: 60 * DAY,
      graceWindowMs: Math.floor(60 * DAY * (14 / 30)),
    });
    // stable scaling uses 60/180.
    expect(getPolicy('stable', '90d').graceWindowMs).toBe(Math.floor(90 * DAY * (60 / 180)));
    // volatile scaling uses 5/7.
    expect(getPolicy('volatile', '14d').graceWindowMs).toBe(Math.floor(14 * DAY * (5 / 7)));
  });

  it('ignores a null/empty ttl override and keeps tier defaults', () => {
    expect(getPolicy('standard', null)).toEqual(getPolicy('standard'));
  });
});

describe('evaluateFreshness', () => {
  const base = new Date('2026-06-01T00:00:00.000Z');

  it('classifies fresh, stale_grace, and stale_expired for the standard tier', () => {
    const m = meta({ tier: 'standard' });
    // 10 days: fresh (<= 30d).
    expect(evaluateFreshness(m, new Date(base.getTime() + 10 * DAY))).toBe('fresh');
    // 35 days: within grace (30 < age <= 44).
    expect(evaluateFreshness(m, new Date(base.getTime() + 35 * DAY))).toBe('stale_grace');
    // 60 days: expired (> 44d).
    expect(evaluateFreshness(m, new Date(base.getTime() + 60 * DAY))).toBe('stale_expired');
  });

  it('uses the metadata ttl when no override is given', () => {
    const m = meta({ tier: 'standard', ttl: '2h' });
    expect(evaluateFreshness(m, new Date(base.getTime() + 1 * HOUR))).toBe('fresh');
    expect(evaluateFreshness(m, new Date(base.getTime() + 5 * HOUR))).toBe('stale_expired');
  });

  it('treats missing timestamps as epoch-0 (always expired)', () => {
    const m = meta({ fetched_at: null, validated_at: null });
    expect(evaluateFreshness(m, base)).toBe('stale_expired');
  });
});

describe('checkMaxAgeExpired', () => {
  const base = new Date('2026-06-01T00:00:00.000Z');
  const cached = { metadata: meta() };

  it('returns false when no maxAge is given', () => {
    expect(checkMaxAgeExpired(cached, base, undefined)).toBe(false);
  });

  it('returns false when the entry is within maxAge and true once it exceeds it', () => {
    expect(checkMaxAgeExpired(cached, new Date(base.getTime() + 5 * DAY), '7d')).toBe(false);
    expect(checkMaxAgeExpired(cached, new Date(base.getTime() + 10 * DAY), '7d')).toBe(true);
  });

  it('falls back to epoch-0 base time when timestamps are missing', () => {
    const noTimes = { metadata: meta({ fetched_at: null, validated_at: null }) };
    expect(checkMaxAgeExpired(noTimes, base, '1y')).toBe(true);
  });
});
