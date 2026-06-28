import type { CdpPage } from '../lib/research/browser.js';

/** Shared in-page helpers for traversing Salesforce LWR open shadow roots. */
export const SALESFORCE_SHADOW_DOM_HELPERS = `
const deepElements = (root) => {
  const out = [];
  const visit = (node) => {
    if (node.shadowRoot) visit(node.shadowRoot);
    for (const child of Array.from(node.children || [])) {
      out.push(child);
      visit(child);
    }
  };
  visit(root);
  return out;
};

const deepText = (root) => {
  let txt = '';
  const visit = (node) => {
    if (node.nodeType === 3) {
      txt += node.textContent || '';
    } else if (node.nodeType === 1 || node.nodeType === 9 || node.nodeType === 11) {
      const tag = node.tagName ? node.tagName.toLowerCase() : '';
      if (tag !== 'style' && tag !== 'script') {
        if (node.shadowRoot) visit(node.shadowRoot);
        for (const child of Array.from(node.childNodes || [])) visit(child);
      }
    }
  };
  visit(root);
  return txt;
};

const textLenFor = (el) =>
  Math.max((el.innerText || '').trim().length, deepText(el).trim().length);
`;

/**
 * In-page block: pick the highest-priority content container that exists on the page.
 * Does not fall through to lower-priority selectors when a higher-priority host is present
 * (e.g. doc-content-layout banner vs doc-amf-reference table).
 */
export function buildPriorityContainerPickBlock(
  selectors: string[],
  minChars: number,
  containerVar = 'container'
): string {
  return `
    let ${containerVar} = null;
    const SELECTORS = ${JSON.stringify(selectors)};
    const MIN_CHARS = ${minChars};
    for (const sel of SELECTORS) {
      let best = null, bestLen = 0, anyMatch = false;
      for (const el of deepElements(document)) {
        let matched;
        try { matched = el.matches && el.matches(sel); } catch (e) { matched = false; }
        if (!matched) continue;
        anyMatch = true;
        const len = textLenFor(el);
        if (len > bestLen) { best = el; bestLen = len; }
      }
      if (anyMatch) {
        if (best && bestLen >= MIN_CHARS) ${containerVar} = best;
        break;
      }
    }
    ${containerVar} = ${containerVar} || document.body || document.documentElement;
  `;
}

/** CDP expression polled until the priority content host reaches minChars and the body settles. */
export function buildContentReadyProbeExpression(selectors: string[], minChars: number): string {
  return `(() => {
    ${SALESFORCE_SHADOW_DOM_HELPERS}
    const SELS = ${JSON.stringify(selectors)};
    const MIN = ${minChars};
    let has = false;
    for (const sel of SELS) {
      let bestLen = 0, anyMatch = false;
      for (const el of deepElements(document)) {
        let matched;
        try { matched = el.matches && el.matches(sel); } catch (e) { matched = false; }
        if (!matched) continue;
        anyMatch = true;
        const len = textLenFor(el);
        if (len > bestLen) bestLen = len;
      }
      if (anyMatch) {
        has = bestLen >= MIN;
        break;
      }
    }
    const len = document.body ? ((document.body.innerText) || '').length : 0;
    return { has, len };
  })()`;
}

/**
 * Polls until the priority Salesforce content host is ready and body text has settled.
 * Returns without throwing on timeout; the caller captures whatever rendered and judges quality.
 */
export async function pollSalesforceContentReady(
  page: CdpPage,
  selectors: string[],
  minChars: number,
  timeoutMs: number
): Promise<void> {
  const expression = buildContentReadyProbeExpression(selectors, minChars);
  const start = Date.now();
  let previousLength = -1;
  let stablePolls = 0;
  while (Date.now() - start < timeoutMs) {
    const rawResult = await page.client
      .send('Runtime.evaluate', { expression, returnByValue: true }, page.sessionId)
      .catch(() => null);
    const value = rawResult?.result?.value;
    if (value?.has) {
      const grew =
        Math.abs((value.len || 0) - previousLength) > Math.max(40, previousLength * 0.02);
      if (!grew && ++stablePolls >= 2) return;
      if (grew) stablePolls = 0;
      previousLength = value.len || 0;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}
