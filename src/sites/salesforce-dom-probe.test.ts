import { describe, it, expect, vi } from 'vitest';
import { parseHTML } from 'linkedom';
import type { CdpPage } from '../lib/research/browser.js';
import {
  buildPriorityContainerPickBlock,
  pollSalesforceContentReady,
  SALESFORCE_SHADOW_DOM_HELPERS,
} from './salesforce-dom-probe.js';

describe('pollSalesforceContentReady', () => {
  it('resolves immediately if page has settled content', async () => {
    let callCount = 0;
    const client = {
      on: vi.fn(),
      send: vi.fn(async (method) => {
        if (method === 'Runtime.evaluate') {
          callCount++;
          return { result: { value: { has: true, len: 100 } } };
        }
        return {};
      }),
    };
    const page = { client, sessionId: 'S', close: vi.fn() } as unknown as CdpPage;

    await pollSalesforceContentReady(page, ['.content'], 10, 5000);
    expect(callCount).toBeGreaterThanOrEqual(2);
  });

  it('polls and waits for rendering to settle if content grows', async () => {
    let callCount = 0;
    const client = {
      on: vi.fn(),
      send: vi.fn(async (method) => {
        if (method === 'Runtime.evaluate') {
          callCount++;
          if (callCount === 1) return { result: { value: { has: true, len: 10 } } };
          if (callCount === 2) return { result: { value: { has: true, len: 100 } } };
          return { result: { value: { has: true, len: 100 } } };
        }
        return {};
      }),
    };
    const page = { client, sessionId: 'S', close: vi.fn() } as unknown as CdpPage;

    await pollSalesforceContentReady(page, ['.content'], 10, 5000);
    expect(callCount).toBeGreaterThanOrEqual(3);
  });

  it('returns on the first sample when the page is a not-found shell', async () => {
    let callCount = 0;
    const client = {
      on: vi.fn(),
      send: vi.fn(async (method) => {
        if (method === 'Runtime.evaluate') {
          callCount++;
          return { result: { value: { has: true, len: 80, error: true } } };
        }
        return {};
      }),
    };
    const page = { client, sessionId: 'S', close: vi.fn() } as unknown as CdpPage;

    await pollSalesforceContentReady(page, ['.content'], 10, 5000);
    expect(callCount).toBe(1);
  });
});

describe('buildPriorityContainerPickBlock', () => {
  function pickedId(html: string, hash: string): string {
    const { document } = parseHTML(html);
    const pick = new Function(
      'document',
      'location',
      `${SALESFORCE_SHADOW_DOM_HELPERS}\n${buildPriorityContainerPickBlock(['main'], 100)}\nreturn container.id;`
    );
    return pick(document, { hash });
  }

  const page = `<main id="page"><p>${'page '.repeat(40)}</p>
    <div id="tag/Commerce-B2B-Resources/operation/patchCheckoutV2"><p>${'checkout '.repeat(30)}</p></div>
    <div id="tiny">short</div>
  </main>`;

  it('keeps the page when the URL has no hash', () => {
    expect(pickedId(page, '')).toBe('page');
  });

  it('captures the Redoc operation the hash names', () => {
    expect(pickedId(page, '#tag/Commerce-B2B-Resources/operation/patchCheckoutV2')).toBe(
      'tag/Commerce-B2B-Resources/operation/patchCheckoutV2'
    );
  });

  it('ignores a hash whose section is too small to be the article', () => {
    expect(pickedId(page, '#tiny')).toBe('page');
  });
});
