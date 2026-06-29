import { describe, it, expect } from 'vitest';
import { SITES, detectSite, getSiteModuleById } from './index.js';

describe('site modules', () => {
  it('detectSite matches on exact hostname', () => {
    expect(detectSite('https://tanstack.com/query/latest')?.id).toBe('tanstack');
  });

  it("detectSite matches any of a module's domains", () => {
    expect(detectSite('https://help.salesforce.com/articleView')?.id).toBe('salesforce');
  });

  it('routes Salesforce Help and Developer to separate modules', () => {
    expect(detectSite('https://help.salesforce.com/s/articleView')?.id).toBe('salesforce');
    expect(detectSite('https://developer.salesforce.com/docs/x')?.id).toBe('salesforce-developer');
  });

  it('detectSite returns undefined for unknown domains', () => {
    expect(detectSite('https://totally-unknown-xyz.example')).toBeUndefined();
  });

  it('detectSite returns undefined for invalid URLs', () => {
    expect(detectSite('not-a-url')).toBeUndefined();
  });

  it('getSiteModuleById returns the module by id', () => {
    expect(getSiteModuleById('tanstack')?.name).toBe('TanStack');
  });

  it('getSiteModuleById returns undefined for unknown ids', () => {
    expect(getSiteModuleById('definitely-not-registered')).toBeUndefined();
  });

  it('site ids are unique', () => {
    const ids = SITES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('JS-rendered sites default to rendered fetch', () => {
    expect(getSiteModuleById('salesforce')?.defaults?.rendered).toBe(true);
    expect(getSiteModuleById('salesforce-developer')?.defaults?.rendered).toBe(true);
    expect(getSiteModuleById('tanstack')?.defaults?.rendered).toBeUndefined();
  });

  it('TanStack does not force rendered so source-Markdown capture keeps code blocks', () => {
    // Regression: forcing rendered bypassed source resolution and dropped fenced code samples.
    expect(getSiteModuleById('tanstack')?.defaults?.rendered).toBeUndefined();
  });

  it('salesforce help exposes fetchPage', () => {
    const sf = getSiteModuleById('salesforce');
    expect(typeof sf?.fetchPage).toBe('function');
  });

  it('salesforce developer exposes fetchPage', () => {
    const dev = getSiteModuleById('salesforce-developer');
    expect(typeof dev?.fetchPage).toBe('function');
  });
});
