import { describe, it, expect } from 'vitest';
import { isAllowedDocHost, normalizeHelpDocContentUrl } from './coveo.js';

describe('salesforce coveo helpers', () => {
  it('isAllowedDocHost accepts Salesforce doc hosts only', () => {
    expect(isAllowedDocHost('help.salesforce.com')).toBe(true);
    expect(isAllowedDocHost('developer.salesforce.com')).toBe(true);
    expect(isAllowedDocHost('example.com')).toBe(false);
  });

  it('normalizeHelpDocContentUrl rewrites help_doccontent to articleView', () => {
    const raw =
      'https://help.salesforce.com/help_doccontent?id=sf.admin.sso.htm&type=5&language=en_US';
    expect(normalizeHelpDocContentUrl(raw)).toBe(
      'https://help.salesforce.com/s/articleView?id=sf.admin.sso.htm&type=5&language=en_US'
    );
  });

  it('normalizeHelpDocContentUrl leaves non-Help URLs unchanged', () => {
    const url = 'https://developer.salesforce.com/docs/atlas.en-us.api.meta/api/';
    expect(normalizeHelpDocContentUrl(url)).toBe(url);
  });
});
