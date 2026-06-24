import { describe, it, expect } from 'vitest';
import { SITES, detectSite, getSiteModuleById } from './index.js';

describe('site modules', () => {
  it('detectSite matches on exact hostname', () => {
    expect(detectSite('https://react.dev/learn')?.id).toBe('react');
  });

  it("detectSite matches any of a module's domains", () => {
    expect(detectSite('https://legacy.reactjs.org/docs')?.id).toBe('react');
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
    expect(getSiteModuleById('tanstack')?.defaults?.rendered).toBe(true);
    expect(getSiteModuleById('salesforce')?.defaults?.rendered).toBe(true);
    expect(getSiteModuleById('salesforce-developer')?.defaults?.rendered).toBe(true);
    expect(getSiteModuleById('react')?.defaults?.rendered).toBeUndefined();
  });

  it('salesforce help exposes fetchPage and search', () => {
    const sf = getSiteModuleById('salesforce');
    expect(typeof sf?.fetchPage).toBe('function');
    expect(typeof sf?.search).toBe('function');
  });

  it('salesforce developer exposes fetchPage only (no search backend yet)', () => {
    const dev = getSiteModuleById('salesforce-developer');
    expect(typeof dev?.fetchPage).toBe('function');
    expect(dev?.search).toBeUndefined();
  });
});
