import { openCdpPage, waitForLoad, waitForContentReady } from '../lib/research/browser.js';
import { checkDnsSafety } from '../lib/research/fetcher.js';
import { htmlToMarkdown } from '../lib/research/markdown.js';
import type { ExtractionResult } from '../lib/research/extract.js';
import type { SiteFetchResult } from './types.js';

// Both help.salesforce.com and developer.salesforce.com are LWR sites that render doc content
// client-side inside web components (shadow DOM). document.documentElement.outerHTML captures
// only the "Loading…" shell, and Readability prunes the structured result to a single block —
// so this shared fetcher serializes the shadow DOM and converts the content container directly.

const TIMEOUT_MS = 45_000;
const SETTLE_MS = 1_500;
const MIN_CONTENT_CHARS = 100;
// Below this a capture is treated as a shell and retried (a fresh reload of the heavy page).
const SUBSTANTIAL_CHARS = 300;
const MAX_ATTEMPTS = 2;
const BODY_LIMIT_BYTES = 6 * 1024 * 1024;

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

/**
 * In-page capture. Expands collapsed "Show" sections, inlines dx-code-block source (its code
 * lives in a `code-block` attribute, not text), strips chrome, then picks the richest content
 * container and serializes it INCLUDING open shadow roots. The expand/code steps are no-ops on
 * Help pages (which lack those components) and load-bearing on Developer API-reference pages.
 */
function buildCaptureScript(contentSelectors: string[], extraRemove: string[]): string {
  return `(async () => {
    // Collects every descendant element across open shadow roots AND light DOM, including the
    // root's own shadow root (so it works both document-wide and scoped to a single component).
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

    // Pick the content container by selector PRIORITY, not by max text: the selectors are ordered
    // specific→general, so the first one with substantial content is the tight article/doc wrapper.
    // Picking the largest match instead pulls in broader page chrome (nav tree, breadcrumb, chat
    // widget) that surrounds the article. innerText is used because it pierces shadow roots
    // (textContent does not), so a real container is measured rather than scoring 0.
    const SELECTORS = ${JSON.stringify(contentSelectors)};
    const MIN_PICK_CHARS = 200;
    let container = null;
    for (const sel of SELECTORS) {
      let best = null, bestLen = 0;
      for (const el of deepElements(document)) {
        let matched; try { matched = el.matches && el.matches(sel); } catch (e) { matched = false; }
        if (!matched) continue;
        const len = (el.innerText || '').trim().length;
        if (len > bestLen) { best = el; bestLen = len; }
      }
      if (best && bestLen >= MIN_PICK_CHARS) { container = best; break; }
    }
    container = container || document.body || document.documentElement;
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

/**
 * Renders a Salesforce LWR doc page, serializes its shadow-DOM content container, and converts
 * it to Markdown. Validates the host before any network access.
 */
export async function fetchSalesforceDoc(
  url: string,
  { allowedHost, contentSelectors, removeSelectors = [] }: SalesforceDocOptions
): Promise<SiteFetchResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid Salesforce doc URL: ${url}`);
  }
  if (parsed.hostname.toLowerCase() !== allowedHost) {
    throw new Error(`Refusing to fetch host "${parsed.hostname}" (expected ${allowedHost}).`);
  }
  await checkDnsSafety(parsed.hostname);

  const captureScript = buildCaptureScript(contentSelectors, removeSelectors);
  const page = await openCdpPage();
  try {
    let html = '';
    let title = '';
    let detailedMarkdown = '';

    // The heavy api-console renders intermittently slowly; reload and retry if a capture comes
    // back shell-thin rather than caching an empty page.
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      await page.client.send('Page.navigate', { url }, page.sessionId);
      await waitForLoad(page.client, page.sessionId, TIMEOUT_MS, 0).catch(() => {});
      await page.client
        .send('Runtime.evaluate', { expression: ACCEPT_CONSENT_EXPRESSION }, page.sessionId)
        .catch(() => {});
      await waitForContentReady(page, contentSelectors, MIN_CONTENT_CHARS, TIMEOUT_MS);
      await new Promise((r) => setTimeout(r, SETTLE_MS));

      const result = await page.client.send(
        'Runtime.evaluate',
        { expression: captureScript, awaitPromise: true, returnByValue: true },
        page.sessionId
      );
      const captured = result?.result?.value;
      html = typeof captured?.html === 'string' ? captured.html : '';
      title = captured?.title || '';
      if (Buffer.byteLength(html) > BODY_LIMIT_BYTES) {
        throw new Error(`Page exceeded body size limit (${Buffer.byteLength(html)} bytes).`);
      }
      detailedMarkdown = stripBoilerplate(htmlToMarkdown(html));
      if (detailedMarkdown.length >= SUBSTANTIAL_CHARS) break;
    }

    if (detailedMarkdown.length < MIN_CONTENT_CHARS || looksLikeSalesforceError(detailedMarkdown)) {
      throw new Error(
        `Salesforce returned no readable content for ${url} (page may be missing, gated, or still loading).`
      );
    }

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
        qualityNotes: ['extracted from rendered shadow-DOM content container'],
      },
    };
  } finally {
    await page.close();
  }
}
