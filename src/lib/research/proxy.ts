import { EnvHttpProxyAgent, type Dispatcher } from 'undici';

function firstEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return undefined;
}

/**
 * Sandboxed execution environments (e.g. Claude Code's remote sandbox) block direct outbound
 * connections to most hosts and instead require routing through a pre-configured HTTP(S) proxy,
 * advertised via the standard *_PROXY env vars. Detecting it lets Bonsai transparently reach
 * sites — like developer.salesforce.com — that are otherwise unreachable from within the sandbox.
 */
export function isProxyConfigured(): boolean {
  return Boolean(firstEnv('HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy'));
}

let cachedDispatcher: Dispatcher | undefined;

/**
 * An undici Dispatcher that honors HTTPS_PROXY/HTTP_PROXY/NO_PROXY, or undefined when no proxy
 * is configured so callers fall back to normal direct networking.
 */
export function getProxyDispatcher(): Dispatcher | undefined {
  if (!isProxyConfigured()) return undefined;
  cachedDispatcher ??= new EnvHttpProxyAgent();
  return cachedDispatcher;
}

/**
 * Chrome CLI flags that route headless navigation through the same proxy as fetch(), or an
 * empty array when no proxy is configured. Chrome has its own network stack (CDP navigation
 * never goes through Node's fetch/undici), so it needs to be told about the proxy separately.
 */
export function getChromeProxyArgs(): string[] {
  const proxyUrl = firstEnv('HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy');
  if (!proxyUrl) return [];

  const args = [`--proxy-server=${proxyUrl}`];
  const noProxy = firstEnv('NO_PROXY', 'no_proxy');
  if (noProxy) args.push(`--proxy-bypass-list=${noProxy}`);
  return args;
}
