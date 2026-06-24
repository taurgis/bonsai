import { describe, it, expect } from 'vitest';
import { looksLikeSalesforceError, stripBoilerplate } from './salesforce-doc-fetch.js';

describe('stripBoilerplate', () => {
  it('removes the article-feedback widget lines but keeps real content', () => {
    const md = [
      '# Search Categories',
      '',
      '**Did this article solve your issue?**',
      'Let us know so we can improve!',
      'Share your feedback',
      '',
      'The query attribute specifies a complex query.',
    ].join('\n');
    const out = stripBoilerplate(md);
    expect(out).toContain('# Search Categories');
    expect(out).toContain('The query attribute specifies a complex query.');
    expect(out).not.toMatch(/did this article solve/i);
    expect(out).not.toMatch(/let us know so we can improve/i);
    expect(out).not.toMatch(/share your feedback/i);
  });

  it('drops empty-anchor links but keeps real links and images', () => {
    const md = [
      '# Title',
      '[](https://help.salesforce.com/s?language=en_US)',
      '[Real link](https://example.com)',
      '![diagram](https://example.com/img.png)',
    ].join('\n');
    const out = stripBoilerplate(md);
    expect(out).not.toMatch(/^\[\]\(/m);
    expect(out).toContain('[Real link](https://example.com)');
    expect(out).toContain('![diagram](https://example.com/img.png)');
  });
});

describe('salesforce doc error detection', () => {
  it('flags not-found / loading / error shells', () => {
    expect(looksLikeSalesforceError('Error: page not found')).toBe(true);
    expect(looksLikeSalesforceError("Sorry, that page doesn't exist.")).toBe(true);
    expect(looksLikeSalesforceError("We couldn't find what you were looking for")).toBe(true);
    expect(looksLikeSalesforceError('We looked high and low...')).toBe(true);
    expect(looksLikeSalesforceError('Loading… Sorry to interrupt')).toBe(true);
  });

  it('passes real documentation content through', () => {
    expect(
      looksLikeSalesforceError(
        'Use the Query resource to execute a SOQL query that returns results.'
      )
    ).toBe(false);
  });
});
