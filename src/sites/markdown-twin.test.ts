import { describe, it, expect, vi } from 'vitest';
import { probeMarkdownTwin } from './markdown-twin.js';

const HOST = 'example.com';
const A = 'https://example.com/help-admin/x.md';
const B = 'https://example.com/help-merchant/x.md';

function markdownResponse(overrides: Record<string, unknown> = {}) {
  const content =
    (overrides.content as string) ??
    '# Title\n\nEnough body text to clear the minimum viable article length threshold used for validating a real twin response in this test suite.\n';
  return {
    status: 200,
    contentType: 'text/markdown; charset=utf-8',
    etag: null,
    lastModified: null,
    finalUrl: A,
    responseSize: Buffer.byteLength(content),
    content,
    ...overrides,
  };
}

describe('probeMarkdownTwin', () => {
  it('returns a SiteFetchResult with route_markdown provenance for the first validated candidate', async () => {
    const fetcher = vi.fn().mockResolvedValue(markdownResponse());
    const out = await probeMarkdownTwin([A, B], { allowedHost: HOST, fetcher });

    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith(
      A,
      expect.objectContaining({ timeoutMs: expect.any(Number) })
    );
    expect(out!.captureMethod).toBe('route_markdown');
    expect(out!.sourceDocUrl).toBe(A);
    expect(out!.extraction.title).toBe('Title');
    expect(out!.fetchResult.contentType).toContain('text/markdown');
  });

  it('falls through to the next candidate when an earlier one 404s or fails validation', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('Fetch failed with status 404'))
      .mockResolvedValueOnce(markdownResponse({ finalUrl: B }));

    const out = await probeMarkdownTwin([A, B], { allowedHost: HOST, fetcher });

    expect(fetcher).toHaveBeenNthCalledWith(1, A, expect.anything());
    expect(fetcher).toHaveBeenNthCalledWith(2, B, expect.anything());
    expect(out!.sourceDocUrl).toBe(B);
  });

  it('returns null when every candidate fails', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('Fetch failed with status 404'));
    expect(await probeMarkdownTwin([A, B], { allowedHost: HOST, fetcher })).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('rejects a twin thinner than the minimum viable article and tries the next candidate', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(markdownResponse({ content: '# Stub\n' }))
      .mockResolvedValueOnce(markdownResponse({ finalUrl: B }));

    const out = await probeMarkdownTwin([A, B], { allowedHost: HOST, fetcher });
    expect(out!.sourceDocUrl).toBe(B);
  });

  it('rejects a redirect that left the allowed host', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(markdownResponse({ finalUrl: 'https://evil.example/x.md' }));
    expect(await probeMarkdownTwin([A], { allowedHost: HOST, fetcher })).toBeNull();
  });

  it('passes through injected headers to every candidate fetch', async () => {
    const fetcher = vi.fn().mockResolvedValue(markdownResponse());
    const headers = { 'user-agent': 'curl/8.7.1 test' };
    await probeMarkdownTwin([A], { allowedHost: HOST, fetcher, headers });
    expect(fetcher).toHaveBeenCalledWith(A, expect.objectContaining({ headers }));
  });

  it('applies transformBody before extraction and appends its quality note', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      markdownResponse({
        content:
          '# Title\n\nDROP_ME\n\nEnough body text to clear the minimum viable article length threshold used for validating a transformed twin response in this test suite.\n',
      })
    );
    const transformBody = (raw: string) => ({
      body: raw.replace('DROP_ME\n\n', ''),
      qualityNote: '1 directive(s) removed',
    });

    const out = await probeMarkdownTwin([A], { allowedHost: HOST, fetcher, transformBody });

    expect(out!.extraction.detailedMarkdown).not.toContain('DROP_ME');
    expect(out!.extraction.qualityNotes?.join(' ')).toContain('1 directive(s) removed');
    // fetchResult.content keeps the raw, untransformed body — the transform only affects extraction.
    expect(out!.fetchResult.content).toContain('DROP_ME');
  });
});
