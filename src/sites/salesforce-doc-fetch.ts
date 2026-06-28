import {
  openCdpPage,
  waitForLoad,
  ResponseCapture,
  type CdpPage,
} from '../lib/research/browser.js';
import { checkDnsSafety } from '../lib/research/fetcher.js';
import { htmlToMarkdown } from '../lib/research/markdown.js';
import { contentMetrics, contentRicherThan } from '../lib/research/regression.js';
import type { ExtractionResult } from '../lib/research/extract.js';
import type { SiteFetchResult } from './types.js';
import {
  SALESFORCE_SHADOW_DOM_HELPERS,
  buildPriorityContainerPickBlock,
  pollSalesforceContentReady,
} from './salesforce-dom-probe.js';

// Both help.salesforce.com and developer.salesforce.com are LWR sites that render doc content
// client-side inside web components (shadow DOM). document.documentElement.outerHTML captures
// only the "Loading…" shell, and Readability prunes the structured result to a single block —
// so this shared fetcher serializes the shadow DOM and converts the content container directly.

const TIMEOUT_MS = 45_000;
const SETTLE_MS = 1_500;
/** Minimum text on the priority content host before wait/capture proceed (shared threshold). */
const MIN_CONTAINER_CHARS = 100;
// Below this a capture is treated as a shell and retried (a fresh reload of the heavy page).
const SUBSTANTIAL_CHARS = 300;
const MAX_ATTEMPTS = 2;
const BODY_LIMIT_BYTES = 6 * 1024 * 1024;
/** Grace period after DOM settle for late /docs/get_document_content/ responses on guide pages. */
const DOCS_API_GRACE_MS = 500;

const ACCEPT_CONSENT_EXPRESSION =
  "(() => { const b = document.querySelector('#onetrust-accept-btn-handler'); if (b) b.click(); })()";

const ERROR_PATTERNS = [
  /page\s*(not\s*found|doesn'?t\s*exist|can'?t\s*be\s*found)/i,
  /we\s*couldn'?t\s*find/i,
  /we looked high and low/i,
  /sorry to interrupt/i,
];

/** True when the extracted text is an error/not-found/loading shell rather than real content. */
export function looksLikeSalesforceError(text: string): boolean {
  return ERROR_PATTERNS.some((re) => re.test(text));
}

// Chrome present on every LWR doc page; stripped before serialization. Per-site noise (e.g.
// Help's article-feedback widget) is appended via SalesforceDocOptions.removeSelectors.
const BASE_REMOVE_SELECTORS = [
  'nav',
  'header',
  'footer',
  'aside',
  'script',
  'style',
  'link',
  'noscript',
  'hgf-c360nav',
  'hgf-c360contextnav',
  'dx-scroll-manager',
  'dx-skip-nav-link',
  'dw-instrumentation',
  '[role="navigation"]',
  '[aria-label*="Table of Contents" i]',
  '#onetrust-consent-sdk',
  '#onetrust-banner-sdk',
];

function confidenceFor(length: number): ExtractionResult['confidence'] {
  if (length < 500) return 'low';
  if (length < 2000) return 'medium';
  return 'high';
}

// The "Did this article solve your issue?" feedback widget renders on every Salesforce doc
// page. Help wraps it in a removable component (see fetch-page.ts), but Developer renders it
// as bare divs, so we also strip its lines from the converted Markdown for both sites.
const BOILERPLATE_LINE =
  /(did this article solve your issue|let us know so we can improve|share your feedback)/i;

// A link with empty anchor text — e.g. an icon-only "home" logo link. It carries no readable
// content and renders as a bare `[](url)`. (Images `![](url)` are intentionally not matched.)
const EMPTY_LINK_LINE = /^\[\]\([^)]*\)$/;

export function stripBoilerplate(markdown: string): string {
  return markdown
    .split('\n')
    .filter((line) => !BOILERPLATE_LINE.test(line) && !EMPTY_LINK_LINE.test(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const DOCS_CONTENT_API = '/docs/get_document_content/';

/** Parses the Salesforce private content API JSON payload. */
export function parseDocsApiPayload(raw: string): { content: string; title: string } | null {
  if (!raw?.trim()) return null;
  try {
    const payload = JSON.parse(raw) as { content?: string; title?: string; id?: string };
    if (!payload.content) return null;
    return { content: payload.content, title: payload.title || payload.id || '' };
  } catch {
    return null;
  }
}

/** Keeps whichever Markdown source carries more structural content (DOM vs content API HTML). */
export function preferRicherMarkdown(
  domMarkdown: string,
  apiHtml: string,
  domTitle: string,
  apiTitle: string
): { markdown: string; title: string; usedApi: boolean } {
  const apiMarkdown = stripBoilerplate(htmlToMarkdown(apiHtml));
  if (contentRicherThan(contentMetrics(apiMarkdown), contentMetrics(domMarkdown))) {
    return {
      markdown: apiMarkdown,
      title: apiTitle || domTitle,
      usedApi: true,
    };
  }
  return { markdown: domMarkdown, title: domTitle, usedApi: false };
}

/**
 * In-page capture. Expands collapsed "Show" sections, inlines dx-code-block source (its code
 * lives in a `code-block` attribute, not text), strips chrome, then picks the richest content
 * container and serializes it INCLUDING open shadow roots. The expand/code steps are no-ops on
 * Help pages (which lack those components) and load-bearing on Developer API-reference pages.
 */
function buildCaptureScript(contentSelectors: string[], extraRemove: string[]): string {
  const containerPick = buildPriorityContainerPickBlock(contentSelectors, MIN_CONTAINER_CHARS);
  return `(async () => {
    ${SALESFORCE_SHADOW_DOM_HELPERS}
    // Collapse controls vary by page: <anypoint-button class="toggle-button">, <dx-button>, and
    // older <* class="complex-toggle">. They all render as a button-like element whose entire
    // label is just "Show"/"Hide", so match on that shape rather than a fixed tag list.
    const isToggleControl = (el) =>
      el instanceof HTMLElement &&
      (/button$/.test(el.tagName.toLowerCase()) || el.classList.contains('complex-toggle'));
    const toggleLabel = (el) => (el.textContent || '').replace(/\\s+/g, ' ').trim();

    try {
      const toggles = deepElements(document).filter(
        (el) => isToggleControl(el) && /^show$/i.test(toggleLabel(el))
      );
      for (const t of toggles) { t.click(); await new Promise((r) => setTimeout(r, 80)); }
      // Once expanded the control flips its label to "Hide"; remove every Show/Hide toggle so the
      // bare label doesn't leak into the captured Markdown. Generic across all article types.
      for (const el of deepElements(document)) {
        if (isToggleControl(el) && /^(show|hide)$/i.test(toggleLabel(el))) {
          try { el.remove(); } catch (e) {}
        }
      }
    } catch (e) {}

    try {
      for (const node of deepElements(document)) {
        if (node.tagName && node.tagName.toLowerCase() === 'dx-code-block') {
          const code = (node.getAttribute('code-block') || node.textContent || '')
            .replace(/\\r\\n/g, '\\n').replace(/\\r/g, '\\n').trim();
          if (!code) continue;
          const pre = document.createElement('pre');
          const codeEl = document.createElement('code');
          const lang = node.getAttribute('language');
          if (lang) codeEl.className = 'language-' + lang;
          codeEl.textContent = code;
          pre.appendChild(codeEl);
          node.replaceWith(pre);
        }
      }
    } catch (e) {}

    // AMF API-reference pages render each object's fields as tall stacked blocks
    // (property-shape-document: name / type / constraints / description). Collapse each
    // api-type-document's fields into one compact Markdown table instead. Generic across all
    // API-ref pages; a no-op where these components are absent (e.g. Help articles).
    const firstIn = (host, sel) => deepElements(host).find((e) => { try { return e.matches && e.matches(sel); } catch (x) { return false; } });
    const fieldText = (e) => e ? (e.textContent || '').replace(/\\s+/g, ' ').trim() : '';
    const nearestTypeDoc = (el) => {
      let n = el.parentElement || (el.getRootNode && el.getRootNode().host) || null;
      while (n) {
        if (n.tagName && n.tagName.toLowerCase() === 'api-type-document') return n;
        n = n.parentElement || (n.getRootNode && n.getRootNode().host) || null;
      }
      return null;
    };
    try {
      const groups = new Map();
      for (const shape of deepElements(document)) {
        if (!shape.tagName || shape.tagName.toLowerCase() !== 'property-shape-document') continue;
        const doc = nearestTypeDoc(shape);
        if (!doc) continue;
        if (!groups.has(doc)) groups.set(doc, []);
        groups.get(doc).push(shape);
      }
      const buildRow = (cells, tag) => {
        const tr = document.createElement('tr');
        for (const value of cells) { const cell = document.createElement(tag); cell.textContent = value; tr.appendChild(cell); }
        return tr;
      };
      for (const shapes of groups.values()) {
        const rows = [];
        for (const shape of shapes) {
          const name = fieldText(firstIn(shape, '.property-title'));
          if (!name) continue;
          const type = fieldText(firstIn(shape, '.data-type'));
          // The field description renders in an <arc-marked> markdown component (api-annotation-document
          // is empty). The first one in document order is this field's own; constraints (Min/Max/Enum)
          // come from .property-attribute. Combine them into the Description column.
          const description = fieldText(firstIn(shape, 'arc-marked'));
          const attrs = deepElements(shape)
            .filter((e) => { try { return e.matches && e.matches('.property-attribute'); } catch (x) { return false; } })
            .map(fieldText);
          const desc = [description, attrs.join(', ')].filter(Boolean).join(' — ');
          rows.push([name, type, desc]);
        }
        if (!rows.length) continue;
        const table = document.createElement('table');
        const thead = document.createElement('thead');
        thead.appendChild(buildRow(['Field', 'Type', 'Description'], 'th'));
        const tbody = document.createElement('tbody');
        for (const row of rows) tbody.appendChild(buildRow(row, 'td'));
        table.appendChild(thead);
        table.appendChild(tbody);
        const first = shapes[0];
        if (first.parentNode) first.parentNode.insertBefore(table, first);
        for (const shape of shapes) { try { shape.remove(); } catch (e) {} }
      }
    } catch (e) {}

    const REMOVE = ${JSON.stringify([...BASE_REMOVE_SELECTORS, ...extraRemove])};
    for (const el of deepElements(document)) {
      try { if (el.matches && REMOVE.some((s) => el.matches(s))) el.remove(); } catch (e) {}
    }

    // Collapse api-console code-snippet language selectors to just the rendered example: the
    // dropdown (cURL, HTTP, JavaScript-Fetch, …) is UI chrome, not content. Scoped to snippet
    // widgets so unrelated toolbars elsewhere are untouched. Generic across all API-ref pages.
    const inSnippetWidget = (el) => {
      let n = el;
      while (n) {
        const t = n.tagName && n.tagName.toLowerCase();
        if (t && /(code-snippet|http-snippet|example-render|example-document)/.test(t)) return true;
        n = n.parentElement || (n.getRootNode && n.getRootNode().host) || null;
      }
      return false;
    };
    for (const el of deepElements(document)) {
      const cls = (el.className || '').toString();
      if (/(^|\\s)(toolbar|dropdown-item|dropdown-menu)(\\s|$)/.test(cls) && inSnippetWidget(el)) {
        try { el.remove(); } catch (e) {}
      }
    }

    const append = (src, target, depth) => {
      if (depth > 30) return;
      if (src.nodeType === 3) { target.appendChild(document.createTextNode(src.textContent || '')); return; }
      if (src.nodeType !== 1) return;
      const tag = src.tagName.toLowerCase();
      if (tag === 'style' || tag === 'script' || tag === 'link' || tag === 'noscript' || tag === 'slot' || tag === 'title') return;
      const clone = src.cloneNode(false);
      target.appendChild(clone);
      // Always descend into BOTH the shadow root and light children. API-reference components
      // (property-shape-document, api-type-document, …) hold details in shadow DOM while also
      // having light children; skipping either would cut content. <slot> is skipped above so
      // slotted light content is not duplicated.
      if (src.shadowRoot) {
        for (const c of Array.from(src.shadowRoot.childNodes)) append(c, clone, depth + 1);
      }
      for (const c of Array.from(src.childNodes)) append(c, clone, depth + 1);
    };
    const serialize = (el) => { const root = document.createElement('div'); append(el, root, 0); return root.innerHTML; };

    ${containerPick}
    const title = (document.querySelector('h1')?.textContent || document.title || '').trim();
    return { html: serialize(container), title };
  })()`;
}

export interface SalesforceDocOptions {
  allowedHost: string;
  contentSelectors: string[];
  // Per-site noise to strip in addition to the shared chrome (e.g. Help's feedback widget).
  removeSelectors?: string[];
}

interface CaptureAttemptResult {
  html: string;
  title: string;
  detailedMarkdown: string;
  usedDocsApi: boolean;
}

function parseSalesforceDocUrl(url: string, allowedHost: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid Salesforce doc URL: ${url}`);
  }
  if (parsed.hostname.toLowerCase() !== allowedHost) {
    throw new Error(`Refusing to fetch host "${parsed.hostname}" (expected ${allowedHost}).`);
  }
  return parsed;
}

function assertReadableSalesforceContent(detailedMarkdown: string, url: string): void {
  if (detailedMarkdown.length < MIN_CONTAINER_CHARS || looksLikeSalesforceError(detailedMarkdown)) {
    throw new Error(
      `Salesforce returned no readable content for ${url} (page may be missing, gated, or still loading).`
    );
  }
}

async function captureSalesforceAttempt(
  page: CdpPage,
  url: string,
  captureScript: string,
  contentSelectors: string[]
): Promise<CaptureAttemptResult> {
  const docsCapture = new ResponseCapture(page, [
    {
      key: 'docs-content',
      test: (request) => request.url.includes(DOCS_CONTENT_API),
      accept: (body) => parseDocsApiPayload(body) !== null,
    },
  ]);

  await page.client.send('Page.navigate', { url }, page.sessionId);
  await waitForLoad(page.client, page.sessionId, TIMEOUT_MS, 0).catch(() => {});
  await page.client
    .send('Runtime.evaluate', { expression: ACCEPT_CONSENT_EXPRESSION }, page.sessionId)
    .catch(() => {});
  await pollSalesforceContentReady(page, contentSelectors, MIN_CONTAINER_CHARS, TIMEOUT_MS);
  await new Promise((r) => setTimeout(r, SETTLE_MS));
  const docsPayload = parseDocsApiPayload(
    (await docsCapture.waitFor('docs-content', DOCS_API_GRACE_MS)) ?? ''
  );
  const docsApiHtml = docsPayload?.content ?? '';
  const docsApiTitle = docsPayload?.title ?? '';

  const result = await page.client.send(
    'Runtime.evaluate',
    { expression: captureScript, awaitPromise: true, returnByValue: true },
    page.sessionId
  );
  const captured = result?.result?.value;
  const html = typeof captured?.html === 'string' ? captured.html : '';
  const title = captured?.title || '';
  if (Buffer.byteLength(html) > BODY_LIMIT_BYTES) {
    throw new Error(`Page exceeded body size limit (${Buffer.byteLength(html)} bytes).`);
  }
  let detailedMarkdown = stripBoilerplate(htmlToMarkdown(html));
  let usedDocsApi = false;

  if (docsApiHtml) {
    const picked = preferRicherMarkdown(detailedMarkdown, docsApiHtml, title, docsApiTitle);
    detailedMarkdown = picked.markdown;
    if (picked.usedApi) {
      usedDocsApi = true;
    }
    return { html, title: picked.title, detailedMarkdown, usedDocsApi };
  }

  return { html, title, detailedMarkdown, usedDocsApi };
}

function buildSalesforceFetchResult(
  url: string,
  html: string,
  title: string,
  detailedMarkdown: string,
  qualityNotes: string[]
): SiteFetchResult {
  return {
    fetchResult: {
      contentType: 'text/html',
      etag: null,
      lastModified: null,
      finalUrl: url,
      responseSize: Buffer.byteLength(html),
      content: html,
    },
    extraction: {
      title: title || url,
      detailedMarkdown,
      confidence: confidenceFor(detailedMarkdown.length),
      qualityNotes,
    },
  };
}

/**
 * Renders a Salesforce LWR doc page, serializes its shadow-DOM content container, and converts
 * it to Markdown. Validates the host before any network access.
 */
export async function fetchSalesforceDoc(
  url: string,
  { allowedHost, contentSelectors, removeSelectors = [] }: SalesforceDocOptions
): Promise<SiteFetchResult> {
  const parsed = parseSalesforceDocUrl(url, allowedHost);
  await checkDnsSafety(parsed.hostname);

  const captureScript = buildCaptureScript(contentSelectors, removeSelectors);
  const page = await openCdpPage();
  try {
    let html = '';
    let title = '';
    let detailedMarkdown = '';
    let usedDocsApi = false;
    const qualityNotes = ['extracted from rendered shadow-DOM content container'];

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const captured = await captureSalesforceAttempt(page, url, captureScript, contentSelectors);
      html = captured.html;
      title = captured.title;
      detailedMarkdown = captured.detailedMarkdown;
      usedDocsApi = usedDocsApi || captured.usedDocsApi;
      if (detailedMarkdown.length >= SUBSTANTIAL_CHARS) break;
    }

    assertReadableSalesforceContent(detailedMarkdown, url);
    if (usedDocsApi) {
      qualityNotes.push('article body from /docs/get_document_content/ API');
    }

    return buildSalesforceFetchResult(url, html, title, detailedMarkdown, qualityNotes);
  } finally {
    await page.close();
  }
}
