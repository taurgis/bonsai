import { spawn, ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { checkDnsSafety } from './fetcher.js';
import { normalizeUrl } from './url.js';

export interface BrowserFetchOptions {
  timeoutMs?: number;
  bodyLimitBytes?: number;
  // Extra time to let client-side JS render after the page is ready (SPAs need this).
  settleMs?: number;
}

export interface BrowserFetchResult {
  status: number;
  contentType: string | null;
  etag: string | null;
  lastModified: string | null;
  finalUrl: string;
  responseSize: number;
  content: string;
}

export class CdpClient {
  private ws: WebSocket;
  private nextId = 1;
  private pending = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>();
  private handlers = new Map<string, Array<(params: any) => void>>();

  constructor(url: string) {
    this.ws = new WebSocket(url);
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data as string);
        if (msg.id) {
          const promise = this.pending.get(msg.id);
          if (promise) {
            this.pending.delete(msg.id);
            if (msg.error) {
              promise.reject(new Error(msg.error.message));
            } else {
              promise.resolve(msg.result);
            }
          }
        } else if (msg.method) {
          const key = msg.sessionId ? `${msg.sessionId}:${msg.method}` : msg.method;
          const listeners = this.handlers.get(key) ?? this.handlers.get(msg.method);
          if (listeners) {
            listeners.forEach((handler) => handler(msg.params));
          }
        }
      };
    });
  }

  send(method: string, params?: any, sessionId?: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      const payload: any = { id, method, params };
      if (sessionId) {
        payload.sessionId = sessionId;
      }
      this.ws.send(JSON.stringify(payload));
    });
  }

  on(event: string, handler: (params: any) => void) {
    const listeners = this.handlers.get(event) ?? [];
    listeners.push(handler);
    this.handlers.set(event, listeners);
  }

  close() {
    this.ws.close();
  }
}

export function findChromePath(): string {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  const paths: string[] = [];
  if (process.platform === 'darwin') {
    paths.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    );
  } else if (process.platform === 'win32') {
    paths.push(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    );
  } else {
    paths.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser'
    );
  }

  for (const p of paths) {
    if (existsSync(p)) return p;
  }

  try {
    const cmd =
      process.platform === 'win32'
        ? 'where chrome'
        : 'which google-chrome || which chromium || which google-chrome-stable';
    const resolved = execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
      .split('\n')[0];
    if (resolved && existsSync(resolved)) {
      return resolved;
    }
  } catch {}

  throw new Error(
    'No Chrome or Chromium browser found for browser-based extraction. Install Chrome/Chromium or ' +
      'set CHROME_PATH to the browser executable. Static (non-rendered) fetching does not require a browser.'
  );
}

async function spawnChrome(
  chromePath: string
): Promise<{ chromeProcess: ChildProcess; wsUrl: string }> {
  const chromeProcess = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=0',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-extensions',
    '--disable-dev-shm-usage',
  ]);

  try {
    const wsUrl = await new Promise<string>((resolve, reject) => {
      let output = '';
      const timeoutId = setTimeout(() => {
        chromeProcess.kill('SIGKILL');
        reject(new Error('Timed out waiting for Chrome to start.'));
      }, 10000);

      const onData = (data: Buffer) => {
        output += data.toString();
        const match = output.match(/ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[a-zA-Z0-9-]+/);
        if (match) {
          clearTimeout(timeoutId);
          cleanup();
          resolve(match[0]);
        }
      };

      const cleanup = () => {
        chromeProcess.stderr.off('data', onData);
        chromeProcess.stdout.off('data', onData);
      };

      chromeProcess.stderr.on('data', onData);
      chromeProcess.stdout.on('data', onData);

      chromeProcess.on('error', (err) => {
        clearTimeout(timeoutId);
        cleanup();
        reject(err);
      });

      chromeProcess.on('exit', (code) => {
        clearTimeout(timeoutId);
        cleanup();
        reject(new Error(`Chrome exited prematurely with code ${code}`));
      });
    });

    return { chromeProcess, wsUrl };
  } catch (err) {
    chromeProcess.kill('SIGKILL');
    throw err;
  }
}

export async function waitForLoad(
  client: CdpClient,
  sessionId: string,
  timeoutMs: number,
  settleMs = 1000
): Promise<void> {
  // Resolve on whichever fires first: DOMContentLoaded or the full load event. Heavy SPAs
  // (e.g. Salesforce LWR) often never fire `load`, so requiring it would falsely time out.
  let ready = false;
  const markReady = () => {
    ready = true;
  };
  client.on(`${sessionId}:Page.domContentEventFired`, markReady);
  client.on(`${sessionId}:Page.loadEventFired`, markReady);

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (ready) {
      const settle = Math.min(settleMs, timeoutMs - (Date.now() - start));
      if (settle > 0) await new Promise((r) => setTimeout(r, settle));
      return;
    }
    await new Promise((r) => setTimeout(r, Math.min(100, timeoutMs - (Date.now() - start))));
  }

  throw new Error(`Navigation timed out after ${timeoutMs}ms`);
}

export const BLOCKED_ASSET_URLS = [
  '*.css',
  '*.png',
  '*.jpg',
  '*.jpeg',
  '*.gif',
  '*.svg',
  '*.woff',
  '*.woff2',
  '*.ttf',
  '*.mp4',
  '*.mp3',
  '*.ico',
];

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface CdpPage {
  client: CdpClient;
  sessionId: string;
  close: () => Promise<void>;
}

/** Status line of the main-frame document response, captured from Network.responseReceived. */
export interface MainDocumentResponse {
  status: number;
  statusText: string;
}

/**
 * Rejects a rendered page whose main document returned an HTTP error, mirroring the static
 * fetcher's `assertOk`. Without this, `--rendered` on a 404/500 would capture the server's (or
 * the browser's) error page as if it were real content and cache it. A missing response (no
 * Document event seen — e.g. data: or about: targets) is left to the caller's content checks.
 */
export function assertRenderedHttpOk(mainDoc: MainDocumentResponse | undefined): void {
  if (mainDoc && mainDoc.status >= 400) {
    throw new Error(`Fetch failed with status ${mainDoc.status} ${mainDoc.statusText}`.trimEnd());
  }
}

/**
 * Spawns a headless Chrome, attaches a flat CDP session, and enables the Page, Network,
 * and Runtime domains. The caller drives navigation and must call close() when finished.
 */
export async function openCdpPage(): Promise<CdpPage> {
  const chromePath = findChromePath();
  const { chromeProcess, wsUrl } = await spawnChrome(chromePath);
  const client = new CdpClient(wsUrl);

  try {
    await client.connect();
    const { targetId } = await client.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await client.send('Target.attachToTarget', { targetId, flatten: true });

    await client.send('Page.enable', {}, sessionId);
    await client.send('Network.enable', {}, sessionId);
    await client.send('Runtime.enable', {}, sessionId);
    await client.send('Network.setUserAgentOverride', { userAgent: DEFAULT_USER_AGENT }, sessionId);

    const close = async (): Promise<void> => {
      try {
        await client.send('Target.closeTarget', { targetId });
      } catch {}
      client.close();
      chromeProcess.kill('SIGKILL');
    };
    return { client, sessionId, close };
  } catch (err) {
    client.close();
    chromeProcess.kill('SIGKILL');
    throw err;
  }
}

interface RequestWillBeSentEvent {
  requestId: string;
  request?: { url?: string; postData?: string };
}

export interface ResponseMatcher {
  key: string;
  test: (request: { url: string; postData?: string }) => boolean;
  // Optional body filter: when several responses match `test`, capture the first whose
  // body satisfies `accept` (e.g. the one that parses to a token), ignoring the rest.
  accept?: (body: string) => boolean;
}

/**
 * Buffers response bodies for requests matching one of the supplied matchers, keyed by
 * matcher key. Matching happens on requestWillBeSent so predicates can inspect post data
 * (e.g. to tell two same-URL XHRs apart). Works around CdpClient's single-handler-per-event
 * model so several waitFor() calls can track different responses from one navigation.
 * Install before navigating.
 */
export class ResponseCapture {
  private matched = new Map<string, string[]>(); // requestId -> matcher keys
  private bodies = new Map<string, string>(); // matcher key -> response body text
  private waiters = new Map<string, Array<(body: string | null) => void>>();
  private page: CdpPage;
  private matchers: ResponseMatcher[];

  constructor(page: CdpPage, matchers: ResponseMatcher[]) {
    this.page = page;
    this.matchers = matchers;
    const { client, sessionId } = page;
    client.on(`${sessionId}:Network.requestWillBeSent`, (params: RequestWillBeSentEvent) => {
      const request = { url: params.request?.url ?? '', postData: params.request?.postData };
      const keys = this.matchers.filter((m) => m.test(request)).map((m) => m.key);
      if (keys.length) this.matched.set(params.requestId, keys);
    });
    client.on(`${sessionId}:Network.loadingFinished`, (params: { requestId: string }) => {
      void this.onFinished(params.requestId);
    });
  }

  // Body is only available after loadingFinished, per the CDP Network contract.
  private async onFinished(requestId: string): Promise<void> {
    const keys = this.matched.get(requestId);
    if (!keys) return;
    const body = await this.readBody(requestId);
    if (body === null) return;
    for (const key of keys) {
      if (this.bodies.has(key)) continue; // already captured for this key
      const matcher = this.matchers.find((m) => m.key === key);
      if (matcher?.accept && !matcher.accept(body)) continue; // wait for a later matching response
      this.bodies.set(key, body);
      const waiters = this.waiters.get(key) ?? [];
      this.waiters.delete(key);
      waiters.forEach((resolve) => resolve(body));
    }
  }

  private async readBody(requestId: string): Promise<string | null> {
    try {
      const res = await this.page.client.send(
        'Network.getResponseBody',
        { requestId },
        this.page.sessionId
      );
      return res.base64Encoded ? Buffer.from(res.body, 'base64').toString('utf8') : res.body;
    } catch {
      return null;
    }
  }

  /** Resolves with the response body text once a matching response finishes, or null on timeout. */
  waitFor(key: string, timeoutMs: number): Promise<string | null> {
    const existing = this.bodies.get(key);
    if (existing !== undefined) return Promise.resolve(existing);
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), timeoutMs);
      const list = this.waiters.get(key) ?? [];
      list.push((body) => {
        clearTimeout(timer);
        resolve(body);
      });
      this.waiters.set(key, list);
    });
  }
}

// Chrome can emit these on first navigation in headless CI when the cert verifier reloads mid-run.
const TRANSIENT_NAV_ERROR_CODES = ['ERR_CERT_VERIFIER_CHANGED'];

function isTransientBrowserNavigationError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return TRANSIENT_NAV_ERROR_CODES.some((code) => message.includes(code));
}

async function fetchRenderedHtmlOnce(
  url: string,
  options: BrowserFetchOptions = {}
): Promise<BrowserFetchResult> {
  const timeout = options.timeoutMs ?? 15_000;
  const limit = options.bodyLimitBytes ?? 2 * 1024 * 1024;

  const currentUrl = normalizeUrl(url);
  await checkDnsSafety(new URL(currentUrl).hostname);

  const page = await openCdpPage();
  try {
    await page.client.send('Network.setBlockedURLs', { urls: BLOCKED_ASSET_URLS }, page.sessionId);

    // Record the status of each frame's first Document response so we can reject HTTP errors after
    // the page settles. Keyed by frameId; the navigated top frame is matched via the navigate result.
    const documentResponses = new Map<string, MainDocumentResponse>();
    page.client.on(
      `${page.sessionId}:Network.responseReceived`,
      (params: {
        frameId?: string;
        type?: string;
        response?: { status?: number; statusText?: string };
      }) => {
        const { frameId } = params;
        const status = params.response?.status;
        // Only record real numeric statuses: a Document event without a usable status would
        // otherwise store NaN, which silently slips past the `>= 400` guard and the `?? 200`
        // fallback alike, leaking a NaN into BrowserFetchResult.status (declared `number`).
        if (params.type !== 'Document' || !frameId || typeof status !== 'number') return;
        if (documentResponses.has(frameId)) return;
        documentResponses.set(frameId, {
          status,
          statusText: params.response?.statusText ?? '',
        });
      }
    );

    const nav: { frameId?: string; errorText?: string } = await page.client.send(
      'Page.navigate',
      { url: currentUrl },
      page.sessionId
    );
    // A network-level failure (DNS, refused/closed connection, TLS) never fires a load event, so
    // fail fast here instead of waiting out the full navigation timeout on a dead page.
    if (nav.errorText) {
      throw new Error(`Navigation failed: ${nav.errorText}`);
    }

    await waitForLoad(page.client, page.sessionId, timeout, options.settleMs ?? 1000);

    const mainDoc = nav.frameId ? documentResponses.get(nav.frameId) : undefined;
    assertRenderedHttpOk(mainDoc);

    const evalResult = await page.client.send(
      'Runtime.evaluate',
      { expression: 'document.documentElement.outerHTML', returnByValue: true },
      page.sessionId
    );

    const html = evalResult.result?.value;
    if (typeof html !== 'string') {
      throw new Error('Failed to retrieve rendered HTML from browser page.');
    }

    const byteLength = Buffer.byteLength(html);
    if (byteLength > limit) {
      throw new Error(`Response body size limit exceeded. Rendered HTML is ${byteLength} bytes.`);
    }

    return {
      status: mainDoc?.status ?? 200,
      contentType: 'text/html',
      etag: null,
      lastModified: null,
      finalUrl: currentUrl,
      responseSize: byteLength,
      content: html,
    };
  } finally {
    await page.close();
  }
}

export async function fetchRenderedHtml(
  url: string,
  options: BrowserFetchOptions = {}
): Promise<BrowserFetchResult> {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fetchRenderedHtmlOnce(url, options);
    } catch (err) {
      if (attempt === maxAttempts || !isTransientBrowserNavigationError(err)) throw err;
    }
  }

  throw new Error('Failed to fetch rendered HTML after transient browser navigation errors.');
}
