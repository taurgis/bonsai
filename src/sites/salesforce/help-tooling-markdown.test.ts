import { describe, it, expect, vi } from 'vitest';
import {
  deriveHelpToolingSlug,
  candidateHelpToolingUrls,
  fetchHelpToolingMarkdown,
} from './help-tooling-markdown.js';

const HELP_URL =
  'https://help.salesforce.com/s/articleView?id=cc.b2c_inventory_list_object_import_export.htm&type=5';
const ADMIN_MD_URL =
  'https://salesforcecommercecloud.github.io/b2c-developer-tooling/help/help-admin/b2c_inventory_list_object_import_export.md';
const MERCHANT_MD_URL =
  'https://salesforcecommercecloud.github.io/b2c-developer-tooling/help/help-merchant/b2c_inventory_list_object_import_export.md';

function markdownResponse(overrides: Record<string, unknown> = {}) {
  const content =
    (overrides.content as string) ??
    '# Inventory List Object Import and Export in B2C Commerce\n\nB2C Commerce imports or exports Inventory List records using an XML file.\n';
  return {
    status: 200,
    contentType: 'text/markdown; charset=utf-8',
    etag: null,
    lastModified: null,
    finalUrl: ADMIN_MD_URL,
    responseSize: Buffer.byteLength(content),
    content,
    ...overrides,
  };
}

describe('deriveHelpToolingSlug', () => {
  it('extracts the slug from a cc.<slug>.htm article id', () => {
    expect(deriveHelpToolingSlug(HELP_URL)).toBe('b2c_inventory_list_object_import_export');
  });

  it('is case-insensitive on the cc. prefix and .htm suffix', () => {
    expect(
      deriveHelpToolingSlug('https://help.salesforce.com/s/articleView?id=CC.b2c_catalogs.HTM')
    ).toBe('b2c_catalogs');
  });

  it('rejects other hosts', () => {
    expect(
      deriveHelpToolingSlug('https://developer.salesforce.com/s/articleView?id=cc.b2c_catalogs.htm')
    ).toBeNull();
  });

  it('rejects ids that are not the cc.<slug>.htm pattern (numeric knowledge articles)', () => {
    expect(
      deriveHelpToolingSlug('https://help.salesforce.com/s/articleView?id=000391619&type=1')
    ).toBeNull();
  });

  it('rejects a missing id param', () => {
    expect(deriveHelpToolingSlug('https://help.salesforce.com/s/articleView')).toBeNull();
  });

  it('rejects an id whose slug contains characters outside the real slug charset (e.g. path segments)', () => {
    expect(
      deriveHelpToolingSlug(
        'https://help.salesforce.com/s/articleView?id=cc.../../../etc/passwd.htm'
      )
    ).toBeNull();
  });

  it('rejects an invalid URL', () => {
    expect(deriveHelpToolingSlug('not a url')).toBeNull();
  });
});

describe('candidateHelpToolingUrls', () => {
  it('builds one candidate per known category', () => {
    expect(candidateHelpToolingUrls('b2c_inventory_list_object_import_export')).toEqual([
      ADMIN_MD_URL,
      MERCHANT_MD_URL,
    ]);
  });
});

describe('fetchHelpToolingMarkdown', () => {
  it('returns a SiteFetchResult with route_markdown provenance for a validated help-admin twin', async () => {
    const fetcher = vi.fn().mockResolvedValue(markdownResponse());
    const out = await fetchHelpToolingMarkdown(HELP_URL, fetcher);

    expect(fetcher).toHaveBeenCalledWith(
      ADMIN_MD_URL,
      expect.objectContaining({ timeoutMs: expect.any(Number) })
    );
    expect(out).not.toBeNull();
    expect(out!.captureMethod).toBe('route_markdown');
    expect(out!.sourceDocUrl).toBe(ADMIN_MD_URL);
    expect(out!.extraction.title).toBe('Inventory List Object Import and Export in B2C Commerce');
    expect(out!.extraction.detailedMarkdown).toContain('Inventory List records');
    expect(out!.fetchResult.contentType).toContain('text/markdown');
  });

  it('falls through to help-merchant when help-admin 404s', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('Fetch failed with status 404'))
      .mockResolvedValueOnce(markdownResponse({ finalUrl: MERCHANT_MD_URL }));

    const out = await fetchHelpToolingMarkdown(HELP_URL, fetcher);

    expect(fetcher).toHaveBeenNthCalledWith(1, ADMIN_MD_URL, expect.anything());
    expect(fetcher).toHaveBeenNthCalledWith(2, MERCHANT_MD_URL, expect.anything());
    expect(out!.sourceDocUrl).toBe(MERCHANT_MD_URL);
  });

  it('returns null without fetching when no slug can be derived', async () => {
    const fetcher = vi.fn();
    const out = await fetchHelpToolingMarkdown(
      'https://help.salesforce.com/s/articleView?id=000391619&type=1',
      fetcher
    );
    expect(out).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('returns null when both categories 404', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('Fetch failed with status 404'));
    expect(await fetchHelpToolingMarkdown(HELP_URL, fetcher)).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('rejects a 200 HTML soft-404 shell answered for the .md route', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      markdownResponse({
        contentType: 'text/html; charset=utf-8',
        content: '<!DOCTYPE html><html><body>404</body></html>',
      })
    );
    expect(await fetchHelpToolingMarkdown(HELP_URL, fetcher)).toBeNull();
  });

  it('rejects a redirect that left the tooling mirror host', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(markdownResponse({ finalUrl: 'https://evil.example.com/doc.md' }));
    expect(await fetchHelpToolingMarkdown(HELP_URL, fetcher)).toBeNull();
  });

  it('rejects a redirect that downgraded to plain http on the tooling mirror host', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        markdownResponse({ finalUrl: ADMIN_MD_URL.replace('https://', 'http://') })
      );
    expect(await fetchHelpToolingMarkdown(HELP_URL, fetcher)).toBeNull();
  });

  it('rejects a twin thinner than the minimum viable article', async () => {
    const fetcher = vi.fn().mockResolvedValue(markdownResponse({ content: '# Stub\n' }));
    expect(await fetchHelpToolingMarkdown(HELP_URL, fetcher)).toBeNull();
  });
});
