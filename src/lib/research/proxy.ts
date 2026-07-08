import { EnvHttpProxyAgent, type Dispatcher } from 'undici';

// Order matters: undici's own EnvHttpProxyAgent (github.com/nodejs/undici lib/dispatcher/
// env-http-proxy-agent.js) prefers the lowercase variant of each var over its uppercase twin
// when both are set. These lists are read in the same order everywhere in this module so that
// Chrome's CLI flags and undici's dispatcher can never disagree about which value "the" proxy is.
export const HTTPS_PROXY_ENV_VARS = ['https_proxy', 'HTTPS_PROXY'];
export const HTTP_PROXY_ENV_VARS = ['http_proxy', 'HTTP_PROXY'];
export const NO_PROXY_ENV_VARS = ['no_proxy', 'NO_PROXY'];
export const ALL_PROXY_ENV_VARS = [
  ...HTTPS_PROXY_ENV_VARS,
  ...HTTP_PROXY_ENV_VARS,
  ...NO_PROXY_ENV_VARS,
];

// The message undici's ProxyAgent throws (nested in a fetch TypeError's `.cause`) when the proxy
// itself declines to tunnel to the target host — as opposed to any other pre-response transport
// failure (DNS, refused connection, a genuinely unreachable destination). Shared by fetcher.ts
// (to decide whether a proxied failure is worth retrying direct) and fetch.ts's failure-guidance
// patterns (to give proxy-specific advice), so the two stay in sync by construction.
export const PROXY_TUNNEL_REJECTION_PATTERN = /proxy response.*tunneling/i;

function firstEnv(names: string[]): string | undefined {
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
  return Boolean(firstEnv(HTTPS_PROXY_ENV_VARS) || firstEnv(HTTP_PROXY_ENV_VARS));
}

let cachedDispatcher: Dispatcher | undefined;
let cachedProxyEnvSnapshot: string | undefined;

// JSON-encoded rather than joined with a plain delimiter: a delimiter that can also appear inside
// a value (e.g. a space, and NO_PROXY conventionally uses "host1, host2") lets two different sets
// of values collide on the same joined string. JSON.stringify's per-element quoting/escaping is a
// well-tested way to avoid that ambiguity without hand-rolling an escape scheme.
function proxyEnvSnapshot(): string {
  return JSON.stringify(ALL_PROXY_ENV_VARS.map((name) => process.env[name] ?? ''));
}

/**
 * An undici Dispatcher that honors HTTPS_PROXY/HTTP_PROXY/NO_PROXY, or undefined when no proxy
 * is configured so callers fall back to normal direct networking. The dispatcher is expensive
 * enough to be worth reusing across requests, but undici's own agent captures its proxy targets
 * once at construction time and never re-reads them — so the cache is keyed on a snapshot of the
 * relevant env vars and rebuilt whenever that snapshot changes, instead of being pinned forever
 * to whatever was configured on the first call. The discarded dispatcher is closed (not just
 * dropped) so its pooled keep-alive sockets don't leak past the env change that replaced it.
 */
export function getProxyDispatcher(): Dispatcher | undefined {
  if (!isProxyConfigured()) return undefined;
  const snapshot = proxyEnvSnapshot();
  if (!cachedDispatcher || cachedProxyEnvSnapshot !== snapshot) {
    const stale = cachedDispatcher;
    cachedDispatcher = new EnvHttpProxyAgent();
    cachedProxyEnvSnapshot = snapshot;
    void stale?.close().catch(() => {});
  }
  return cachedDispatcher;
}

// undici's EnvHttpProxyAgent treats a bare NO_PROXY entry (e.g. "example.com") as matching both
// the exact host AND any subdomain — it strips a leading "*." or "." before comparing, then
// checks the hostname for an exact or suffix match. Chromium's --proxy-bypass-list grammar draws
// a hard line instead: a bare "example.com" matches only that exact host, and subdomain matching
// requires an explicit "*." prefix. Emitting both forms for every entry reproduces undici's
// exact-or-subdomain behavior in Chrome too, so the two proxied paths agree on what bypasses.
function toChromeBypassList(noProxy: string): string {
  const hosts = noProxy
    .split(/[,\s]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.replace(/^\*?\./, ''));
  return Array.from(new Set(hosts.flatMap((host) => [host, `*.${host}`]))).join(',');
}

/**
 * Chrome CLI flags that route headless navigation through the same proxy as fetch(), or an
 * empty array when no proxy is configured. Chrome has its own network stack (CDP navigation
 * never goes through Node's fetch/undici), so it needs to be told about the proxy separately.
 *
 * Built as a scheme-qualified `--proxy-server` value (`http=...;https=...`) rather than one
 * blanket proxy for every scheme, matching undici's EnvHttpProxyAgent, which picks HTTP_PROXY or
 * HTTPS_PROXY per the target URL's scheme. A single unqualified value would force Chrome to
 * route all its traffic (including plain-http sub-resources) through whichever var happened to
 * be set, silently disagreeing with how fetch() routes the same traffic.
 */
export function getChromeProxyArgs(): string[] {
  const httpsProxy = firstEnv(HTTPS_PROXY_ENV_VARS);
  const httpProxy = firstEnv(HTTP_PROXY_ENV_VARS);
  if (!httpsProxy && !httpProxy) return [];

  const schemeMappings: string[] = [];
  if (httpProxy) schemeMappings.push(`http=${httpProxy}`);
  if (httpsProxy) schemeMappings.push(`https=${httpsProxy}`);
  const args = [`--proxy-server=${schemeMappings.join(';')}`];

  const noProxy = firstEnv(NO_PROXY_ENV_VARS);
  if (noProxy) args.push(`--proxy-bypass-list=${toChromeBypassList(noProxy)}`);
  return args;
}
