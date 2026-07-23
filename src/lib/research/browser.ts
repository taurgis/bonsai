import { spawn, ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { checkDnsSafety } from './fetcher.js';
import {
  getChromeProxyArgs,
  getChromeSpkiArgs,
  getChromeTlsCompatibilityArgs,
  isProxyConfigured,
} from './proxy.js';
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
  // Claude Code's remote sandbox (and other Playwright-provisioned environments) pre-installs a
  // Chromium build under PLAYWRIGHT_BROWSERS_PATH rather than a system package manager location,
  // with a `chromium` symlink at its root pointing at the actual browser binary. It's headless-Chrome
  // capable (needed for the CDP `--headless=new` flag this module uses), so it's checked first.
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) {
    paths.push(join(process.env.PLAYWRIGHT_BROWSERS_PATH, 'chromium'));
  }
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

// Split out from spawnChrome so the exact CLI args (including the proxy flags) are unit-testable
// without spawning a real browser process.
export function buildChromeArgs(): string[] {
  return [
    '--headless=new',
    '--remote-debugging-port=0',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-extensions',
    '--disable-dev-shm-usage',
    // CDP navigation uses Chrome's own network stack, not Node's fetch/undici, so a sandbox
    // proxy detected via *_PROXY env vars must be passed to Chrome separately (see proxy.ts).
    ...getChromeProxyArgs(),
    // The sandbox proxy above re-terminates TLS with its own CA, which Chrome's Chrome-Root-Store
    // verifier doesn't trust by default (unlike Node/curl/Python, which read NODE_EXTRA_CA_CERTS/
    // SSL_CERT_FILE/CURL_CA_BUNDLE). Pin trust to that specific CA rather than disabling
    // verification wholesale (see proxy.ts's getChromeSpkiArgs).
    ...getChromeSpkiArgs(),
    // Separately from cert trust: some sandbox proxies' TLS terminator never responds to Chrome's
    // default TLS 1.3 ClientHello and the connection is eventually reset (see proxy.ts's
    // getChromeTlsCompatibilityArgs for how this was diagnosed).
    ...getChromeTlsCompatibilityArgs(),
  ];
}

// CI runners occasionally starve headless Chrome's startup (disk/CPU contention from concurrent
// jobs), so this is generous enough to absorb that rather than a "typical" local startup time.
const CHROME_STARTUP_TIMEOUT_MS = 20_000;

// Node's default SIGINT/SIGTERM disposition kills the process immediately, without waiting for the
// async `finally { page.close() }` in fetchRenderedHtmlOnce to run — so an interrupted --rendered
// fetch otherwise abandons a whole Chrome process tree (main + zygote/gpu/renderer children). The
// plain 'exit' event covers ordinary completion (belt-and-braces alongside close()'s own cleanup);
// a `once` signal listener runs the same cleanup, then re-sends the signal to this process. Because
// `once` already removed itself, that re-delivery has no listener left and Node's own default
// disposition takes over — the process still exits with the normal 128+signum code, with no exit-code
// bookkeeping of our own.
const liveChromeProcesses = new Set<ChildProcess>();
let chromeCleanupRegistered = false;

function killLiveChromeProcesses(): void {
  for (const chromeProcess of liveChromeProcesses) killChromeTree(chromeProcess);
}

function ensureChromeCleanupRegistered(): void {
  if (chromeCleanupRegistered) return;
  chromeCleanupRegistered = true;
  process.once('exit', killLiveChromeProcesses);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      killLiveChromeProcesses();
      process.kill(process.pid, signal);
    });
  }
}

/**
 * Kill Chrome and every child process it spawned (zygote, gpu-process, renderer, crashpad).
 * `chromeProcess.kill()` alone only signals that one PID — per Node's child_process docs, a signal
 * sent to a child is not propagated to *that child's own* children on Linux, so Chrome's
 * multi-process tree survives a plain kill on every rendered fetch, not just an interrupted one.
 * Spawning with `detached: true` makes Chrome the leader of its own process group, so signaling the
 * negative PID reaches the whole tree in one call. Falls back to a direct kill if group-kill fails
 * (already exited, or a platform without POSIX process groups).
 */
export function killChromeTree(chromeProcess: ChildProcess): void {
  if (typeof chromeProcess.pid === 'number') {
    try {
      process.kill(-chromeProcess.pid, 'SIGKILL');
      return;
    } catch {
      // Fall through to a best-effort direct kill below.
    }
  }
  chromeProcess.kill('SIGKILL');
}

async function spawnChrome(
  chromePath: string
): Promise<{ chromeProcess: ChildProcess; wsUrl: string }> {
  ensureChromeCleanupRegistered();
  const chromeProcess = spawn(chromePath, buildChromeArgs(), { detached: true });
  liveChromeProcesses.add(chromeProcess);
  chromeProcess.once('exit', () => liveChromeProcesses.delete(chromeProcess));

  try {
    const wsUrl = await new Promise<string>((resolve, reject) => {
      let output = '';
      const timeoutId = setTimeout(() => {
        killChromeTree(chromeProcess);
        reject(new Error('Timed out waiting for Chrome to start.'));
      }, CHROME_STARTUP_TIMEOUT_MS);

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
    killChromeTree(chromeProcess);
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
  /**
   * Returns (and clears) the reason the most recent navigation request was blocked by the
   * per-hop safety guard installed in {@link openCdpPage}, or `null` if none was blocked.
   */
  takeBlockedNavigationError: () => Error | null;
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

interface FetchRequestPausedEvent {
  requestId: string;
  request: { url: string };
}

/**
 * Validates a navigated (or redirected) Document request against the same scheme/credentials/DNS
 * safety `normalizeUrl` and `fetchWithRedirects` enforce per hop in url.ts/fetcher.ts. Chrome
 * follows redirects internally with no hook back into that check, so a page that starts on a safe
 * public host could otherwise redirect a rendered-fallback capture into a private/internal address
 * (SSRF) or a non-http(s) scheme (e.g. `file:`) that the static fetcher would have rejected outright.
 */
export async function describeUnsafeNavigationTarget(url: string): Promise<Error | null> {
  let normalized: string;
  try {
    normalized = normalizeUrl(url);
  } catch (err) {
    return err as Error;
  }
  try {
    await checkDnsSafety(new URL(normalized).hostname);
    return null;
  } catch (err) {
    return err as Error;
  }
}

/**
 * Spawns a headless Chrome, attaches a flat CDP session, and enables the Page, Network, Runtime,
 * and Fetch domains. Fetch domain interception guards every Document-type request (the initial
 * navigation and each subsequent redirect) with {@link describeUnsafeNavigationTarget} before
 * Chrome is allowed to send it; a blocked request's reason is recorded and can be read back via
 * the returned page's `takeBlockedNavigationError()`. The caller drives navigation and must call
 * close() when finished.
 */
export async function openCdpPage(): Promise<CdpPage> {
  const chromePath = findChromePath();
  const { chromeProcess, wsUrl } = await spawnChrome(chromePath);
  const client = new CdpClient(wsUrl);
  let blockedNavigationError: Error | null = null;

  try {
    await client.connect();
    const { targetId } = await client.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await client.send('Target.attachToTarget', { targetId, flatten: true });

    await client.send('Page.enable', {}, sessionId);
    await client.send('Network.enable', {}, sessionId);
    await client.send('Runtime.enable', {}, sessionId);
    await client.send('Network.setUserAgentOverride', { userAgent: DEFAULT_USER_AGENT }, sessionId);
    await client.send(
      'Fetch.enable',
      { patterns: [{ urlPattern: '*', resourceType: 'Document', requestStage: 'Request' }] },
      sessionId
    );
    client.on(`${sessionId}:Fetch.requestPaused`, (params: FetchRequestPausedEvent) => {
      // CdpClient.on's handler type is synchronous (CDP event dispatch isn't awaited), so the
      // actual async validate-then-continue/fail work runs in this detached IIFE instead.
      void (async () => {
        const { requestId, request } = params;
        const blockReason = await describeUnsafeNavigationTarget(request.url);
        if (blockReason) {
          blockedNavigationError = blockReason;
          await client
            .send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }, sessionId)
            .catch(() => {});
          return;
        }
        await client.send('Fetch.continueRequest', { requestId }, sessionId).catch(() => {});
      })();
    });

    const close = async (): Promise<void> => {
      try {
        await client.send('Target.closeTarget', { targetId });
      } catch {}
      client.close();
      killChromeTree(chromeProcess);
    };
    const takeBlockedNavigationError = (): Error | null => {
      const err = blockedNavigationError;
      blockedNavigationError = null;
      return err;
    };
    return { client, sessionId, close, takeBlockedNavigationError };
  } catch (err) {
    client.close();
    killChromeTree(chromeProcess);
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

// Chrome has its own network stack (see getChromeProxyArgs), so when a sandbox's egress-enforcing
// proxy declines to tunnel to a destination, Chrome surfaces one of these net-error codes instead
// of the HTTP-level rejection undici sees in fetcher.ts (PROXY_TUNNEL_REJECTION_PATTERN). Matched
// against Page.navigate's `errorText`, which arrives as e.g. "net::ERR_TUNNEL_CONNECTION_FAILED".
const PROXY_BLOCKED_CHROME_NET_ERRORS = [
  'ERR_TUNNEL_CONNECTION_FAILED',
  'ERR_PROXY_CONNECTION_FAILED',
  'ERR_SOCKS_CONNECTION_FAILED',
];

// Shared substring fetch-result.ts's fetchFailureGuidance matches on to attach suggestions/ref to
// this error, without duplicating the message text it needs to match against.
export const SANDBOX_EGRESS_ERROR_MARKER = 'sandboxed execution environment';

/**
 * Builds the error thrown for a failed Page.navigate. When a proxy is configured (proxy.ts's
 * signal for "this is a sandboxed execution environment") and Chrome's failure code indicates the
 * proxy itself declined the tunnel, the destination isn't reachable because of the sandbox's
 * network egress gateway rejecting it, not a real navigation problem — so the message says that
 * explicitly, rather than surfacing a bare Chrome net-error code that looks like a generic
 * connectivity failure. It deliberately doesn't claim the fix is "ask an admin to allowlist this
 * host": the gateway that rejects the CONNECT tunnel can disagree with an org's configured domain
 * policy (a different layer may not reach it), so the safer, always-correct advice is to verify
 * against the environment directly and fall back to a manual fetch if it's still unreachable.
 */
export function describeNavigationFailure(errorText: string, url: string): Error {
  const isProxyBlock =
    isProxyConfigured() && PROXY_BLOCKED_CHROME_NET_ERRORS.some((code) => errorText.includes(code));
  if (!isProxyBlock) {
    return new Error(`Navigation failed: ${errorText}`);
  }

  let host = url;
  try {
    host = new URL(url).hostname;
  } catch {}

  return new Error(
    `Chrome could not reach "${host}" (${errorText}). This looks like a ${SANDBOX_EGRESS_ERROR_MARKER} ` +
      `(e.g. Claude Code's remote sandbox) whose outbound network gateway rejected the connection to ` +
      `this host, via the configured proxy (HTTPS_PROXY/HTTP_PROXY). This can happen even when the ` +
      `environment's domain policy looks unrestricted, since the gateway enforcing egress can be a ` +
      `separate layer from that policy. It can't be worked around from inside the sandbox by retrying ` +
      `or bypassing the proxy: confirm "${host}" is reachable from this environment (e.g. test the ` +
      `proxy directly), or fetch the page from a network with access and import it instead.`
  );
}

// ERR_CERT_VERIFIER_CHANGED: Chrome can emit this on first navigation in headless CI when the cert
// verifier reloads mid-run. ERR_CONNECTION_CLOSED is Chromium's code for a plain remote TCP FIN
// (net_error_list.h), which CI runners can hit as a one-off network blip against a real host
// rather than a real block.
const TRANSIENT_NAV_ERROR_CODES = ['ERR_CERT_VERIFIER_CHANGED', 'ERR_CONNECTION_CLOSED'];

// Resource contention in CI (concurrent jobs competing for CPU/disk) can make Chrome itself fail
// to come up in time, or die before its devtools websocket URL is printed. Neither reflects a
// problem with the target page, so it's worth a fresh attempt rather than failing the whole fetch.
const TRANSIENT_CHROME_STARTUP_MESSAGES = [
  'Timed out waiting for Chrome to start.',
  'Chrome exited prematurely',
];

// Exported so tests can assert the transient-error classification directly rather than only
// indirectly through a live fetchRenderedHtml retry, which needs a real Chrome navigation to fail.
export function isTransientBrowserError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    TRANSIENT_NAV_ERROR_CODES.some((code) => message.includes(code)) ||
    TRANSIENT_CHROME_STARTUP_MESSAGES.some((text) => message.includes(text))
  );
}

/**
 * Navigates an already-open CDP page to `currentUrl` and captures the rendered HTML, honoring the
 * openCdpPage Fetch-domain safety guard at every point a blocked navigation could otherwise be
 * discarded in favor of a less specific (or entirely silent) failure:
 *
 * 1. Right after `Page.navigate` returns — a fast HTTP redirect chain can already be blocked and
 *    resolved by this point, surfacing as the generic `nav.errorText` (e.g. `net::ERR_BLOCKED_BY_CLIENT`)
 *    below if not checked first.
 * 2. If `waitForLoad` throws — a client-side (JS-triggered) navigation into a blocked target after
 *    the initial navigation already settled can prevent the load/domContentLoaded events
 *    `waitForLoad` is waiting on, surfacing as a generic timeout instead of the specific reason.
 * 3. After `waitForLoad` resolves — a client-side navigation blocked without otherwise disrupting
 *    the load signal would otherwise sail through silently, capturing whatever the page settled on.
 *
 * Exported (rather than folded into `fetchRenderedHtmlOnce`) so tests can drive it against a fake
 * `CdpPage` without spawning a real browser.
 */
export async function captureNavigatedPage(
  page: CdpPage,
  currentUrl: string,
  options: { timeout: number; limit: number; settleMs: number }
): Promise<BrowserFetchResult> {
  const { timeout, limit, settleMs } = options;
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
  // See point 1 above: prefer the safety guard's specific reason over the opaque errorText below.
  const blockedNavigation = page.takeBlockedNavigationError();
  if (blockedNavigation) throw blockedNavigation;

  // A network-level failure (DNS, refused/closed connection, TLS) never fires a load event, so
  // fail fast here instead of waiting out the full navigation timeout on a dead page.
  if (nav.errorText) {
    throw describeNavigationFailure(nav.errorText, currentUrl);
  }

  try {
    await waitForLoad(page.client, page.sessionId, timeout, settleMs);
  } catch (err) {
    // See point 2 above: a blocked reason recorded during the wait outranks the generic timeout.
    throw page.takeBlockedNavigationError() ?? err;
  }

  // See point 3 above.
  const blockedNavigationAfterLoad = page.takeBlockedNavigationError();
  if (blockedNavigationAfterLoad) throw blockedNavigationAfterLoad;

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
    return await captureNavigatedPage(page, currentUrl, {
      timeout,
      limit,
      settleMs: options.settleMs ?? 1000,
    });
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
      if (attempt === maxAttempts || !isTransientBrowserError(err)) throw err;
    }
  }

  throw new Error('Failed to fetch rendered HTML after transient browser navigation errors.');
}
