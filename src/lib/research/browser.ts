import { spawn, ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { checkDnsSafety } from './fetcher.js';
import { normalizeUrl } from './url.js';

export interface BrowserFetchOptions {
  timeoutMs?: number;
  bodyLimitBytes?: number;
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
  private handlers = new Map<string, (params: any) => void>();

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
          const handler = this.handlers.get(key) || this.handlers.get(msg.method);
          if (handler) {
            handler(msg.params);
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
    this.handlers.set(event, handler);
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

  throw new Error('Chrome executable not found. Please set CHROME_PATH environment variable.');
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

async function waitForLoad(client: CdpClient, sessionId: string, timeoutMs: number): Promise<void> {
  let loaded = false;
  client.on(`${sessionId}:Page.loadEventFired`, () => {
    loaded = true;
  });

  const start = Date.now();
  let settled = false;
  while (true) {
    const elapsed = Date.now() - start;
    if (elapsed >= timeoutMs) {
      break;
    }
    if (loaded && !settled) {
      const remaining = timeoutMs - elapsed;
      const settleWait = Math.min(1000, remaining);
      if (settleWait > 0) {
        await new Promise((r) => setTimeout(r, settleWait));
      }
      settled = true;
      break;
    }
    await new Promise((r) => setTimeout(r, Math.min(100, timeoutMs - elapsed)));
  }

  if (!loaded || (loaded && !settled && Date.now() - start >= timeoutMs)) {
    throw new Error(`Navigation timed out after ${timeoutMs}ms`);
  }
}

export async function fetchRenderedHtml(
  url: string,
  options: BrowserFetchOptions = {}
): Promise<BrowserFetchResult> {
  const timeout = options.timeoutMs ?? 15_000;
  const limit = options.bodyLimitBytes ?? 2 * 1024 * 1024;

  const currentUrl = normalizeUrl(url);
  const parsedUrl = new URL(currentUrl);
  await checkDnsSafety(parsedUrl.hostname);

  const chromePath = findChromePath();
  const { chromeProcess, wsUrl } = await spawnChrome(chromePath);

  let client: CdpClient | null = null;
  let targetId: string | null = null;

  try {
    client = new CdpClient(wsUrl);
    await client.connect();

    const createResult = await client.send('Target.createTarget', { url: 'about:blank' });
    targetId = createResult.targetId;

    const attachResult = await client.send('Target.attachToTarget', { targetId, flatten: true });
    const sessionId = attachResult.sessionId;

    await client.send('Page.enable', {}, sessionId);
    await client.send('Network.enable', {}, sessionId);
    await client.send('Runtime.enable', {}, sessionId);

    await client.send(
      'Network.setUserAgentOverride',
      {
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      sessionId
    );

    await client.send(
      'Network.setBlockedURLs',
      {
        urls: [
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
        ],
      },
      sessionId
    );

    await client.send('Page.navigate', { url: currentUrl }, sessionId);
    await waitForLoad(client, sessionId, timeout);

    const evalResult = await client.send(
      'Runtime.evaluate',
      {
        expression: 'document.documentElement.outerHTML',
        returnByValue: true,
      },
      sessionId
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
      status: 200,
      contentType: 'text/html',
      etag: null,
      lastModified: null,
      finalUrl: currentUrl,
      responseSize: byteLength,
      content: html,
    };
  } finally {
    if (client && targetId) {
      try {
        await client.send('Target.closeTarget', { targetId });
      } catch {}
    }
    if (client) {
      client.close();
    }
    chromeProcess.kill('SIGKILL');
  }
}
