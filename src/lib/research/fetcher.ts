import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { isSafeIp, normalizeUrl } from './url.js';

export interface FetchOptions {
  timeoutMs?: number;
  bodyLimitBytes?: number;
  maxRedirects?: number;
  headers?: Record<string, string>;
}

export interface FetchResult {
  status: number;
  contentType: string | null;
  etag: string | null;
  lastModified: string | null;
  finalUrl: string;
  responseSize: number;
  content: string;
}

export function looksLikeHtml(text: string): boolean {
  const trimmed = text.trimStart().toLowerCase();
  return (
    trimmed.startsWith('<!doctype html') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<xml') ||
    trimmed.startsWith('<?xml')
  );
}

export async function checkDnsSafety(hostname: string): Promise<void> {
  let hostToResolve = hostname;
  if (hostToResolve.startsWith('[') && hostToResolve.endsWith(']')) {
    hostToResolve = hostToResolve.slice(1, -1);
  }

  if (isIP(hostToResolve) !== 0) {
    if (!isSafeIp(hostToResolve)) {
      throw new Error(`IP address "${hostToResolve}" is a blocked local or private target.`);
    }
    return;
  }

  try {
    const addresses = await lookup(hostToResolve, { all: true });
    for (const addr of addresses) {
      if (!isSafeIp(addr.address)) {
        throw new Error(
          `IP address "${addr.address}" resolved for "${hostname}" is a blocked local or private target.`
        );
      }
    }
  } catch (err) {
    throw new Error(`DNS resolution failed for hostname "${hostname}": ${(err as Error).message}`);
  }
}

async function readBodyWithLimit(body: any, limit: number): Promise<Uint8Array> {
  if (!body) {
    return new Uint8Array(0);
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  for await (const chunk of body) {
    const chunkBytes = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    totalBytes += chunkBytes.byteLength;
    if (totalBytes > limit) {
      throw new Error(`Response body size limit exceeded. Limit is ${limit} bytes.`);
    }
    chunks.push(chunkBytes);
  }

  const result = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

// Shared response metadata. Both the HTML and text processors build their FetchResult from these
// same validator headers, so reading them in one place keeps the two paths from drifting.
function headerMeta(res: Response): Pick<FetchResult, 'contentType' | 'etag' | 'lastModified'> {
  return {
    contentType: res.headers.get('content-type'),
    etag: res.headers.get('etag'),
    lastModified: res.headers.get('last-modified'),
  };
}

// A 304 carries no body; return an empty result that preserves the validator headers.
function notModifiedResult(res: Response, currentUrl: string): FetchResult {
  return { status: 304, ...headerMeta(res), finalUrl: currentUrl, responseSize: 0, content: '' };
}

function assertOk(res: Response): void {
  if (!res.ok) {
    throw new Error(`Fetch failed with status ${res.status} ${res.statusText}`);
  }
}

async function processFetchResponse(
  res: Response,
  limit: number,
  currentUrl: string
): Promise<FetchResult> {
  if (res.status === 304) return notModifiedResult(res, currentUrl);
  assertOk(res);

  const contentType = res.headers.get('content-type');
  if (contentType) {
    const cleanType = (contentType.split(';')[0] || '').toLowerCase().trim();
    if (cleanType !== 'text/html' && cleanType !== 'application/xhtml+xml') {
      throw new Error(`Rejected content type "${contentType}". Only HTML is supported.`);
    }
  }

  const bodyBytes = await readBodyWithLimit(res.body, limit);
  const content = new TextDecoder().decode(bodyBytes);

  if (!contentType && !looksLikeHtml(content)) {
    throw new Error('Rejected response: missing Content-Type and body does not look like HTML.');
  }

  return {
    status: res.status,
    ...headerMeta(res),
    finalUrl: currentUrl,
    responseSize: bodyBytes.byteLength,
    content,
  };
}

// Processes a non-HTML response (llms.txt, route .md, search index JSON). Mirrors the safety of
// processFetchResponse (304, status, size limit) but does NOT reject by content type — the caller
// validates that the body is the artifact kind it asked for. Treated as untrusted text.
async function processTextResponse(
  res: Response,
  limit: number,
  currentUrl: string
): Promise<FetchResult> {
  if (res.status === 304) return notModifiedResult(res, currentUrl);
  assertOk(res);

  const bodyBytes = await readBodyWithLimit(res.body, limit);
  return {
    status: res.status,
    ...headerMeta(res),
    finalUrl: currentUrl,
    responseSize: bodyBytes.byteLength,
    content: new TextDecoder().decode(bodyBytes),
  };
}

// Shared redirect/DNS/timeout loop. The `process` callback decides how to validate and shape the
// final (non-redirect) response, so HTML and text/data fetches reuse identical transport safety.
async function fetchWithRedirects(
  url: string,
  options: FetchOptions,
  process: (res: Response, limit: number, currentUrl: string) => Promise<FetchResult>
): Promise<FetchResult> {
  const timeout = options.timeoutMs ?? 10_000;
  const limit = options.bodyLimitBytes ?? 2 * 1024 * 1024;
  const maxRedirects = options.maxRedirects ?? 5;
  const initialHeaders = options.headers ?? {};

  let currentUrl = normalizeUrl(url);
  let redirectCount = 0;

  while (true) {
    const parsedUrl = new URL(currentUrl);
    await checkDnsSafety(parsedUrl.hostname);

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(currentUrl, {
        method: 'GET',
        headers: initialHeaders,
        redirect: 'manual',
        signal: controller.signal,
      });

      if ([301, 302, 303, 307, 308].includes(res.status)) {
        redirectCount++;
        if (redirectCount > maxRedirects) {
          throw new Error(`Too many redirects. Exceeded limit of ${maxRedirects}.`);
        }
        const location = res.headers.get('location');
        if (!location) {
          throw new Error(`Redirect response status ${res.status} missing Location header.`);
        }
        currentUrl = normalizeUrl(new URL(location, currentUrl).toString());
        continue;
      }

      return await process(res, limit, currentUrl);
    } finally {
      clearTimeout(id);
    }
  }
}

export async function fetchStaticHtml(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult> {
  return fetchWithRedirects(url, options, processFetchResponse);
}

/**
 * Fetches a non-HTML text/data resource (llms.txt, route Markdown, search index) with the same
 * DNS, redirect, timeout, and body-size safety as fetchStaticHtml. Does not enforce a content
 * type; the caller must validate the returned body is the artifact kind it expected.
 */
export async function fetchText(url: string, options: FetchOptions = {}): Promise<FetchResult> {
  return fetchWithRedirects(url, options, processTextResponse);
}

/**
 * Sends a JSON POST and returns the response body text. Used by remote search connectors (e.g.
 * Algolia DocSearch). Enforces the same DNS safety, timeout, and body-size limits as GET fetches.
 */
export async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
  options: FetchOptions = {}
): Promise<string> {
  const timeout = options.timeoutMs ?? 10_000;
  const limit = options.bodyLimitBytes ?? 2 * 1024 * 1024;
  const target = normalizeUrl(url);
  await checkDnsSafety(new URL(target).hostname);

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(target, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      redirect: 'error',
      signal: controller.signal,
    });
    if (!res.ok)
      throw new Error(`Search request failed with status ${res.status} ${res.statusText}`);
    const bytes = await readBodyWithLimit(res.body, limit);
    return new TextDecoder().decode(bytes);
  } finally {
    clearTimeout(id);
  }
}
