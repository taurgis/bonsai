import { describe, it, expect, vi } from 'vitest';
import type { CdpPage } from '../lib/research/browser.js';
import { pollSalesforceContentReady } from './salesforce-dom-probe.js';

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
});
