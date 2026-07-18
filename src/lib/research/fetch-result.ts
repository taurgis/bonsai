import type { StorageMode } from '../config/index.js';
import type { CacheHitStatus, FreshnessState } from '../cli-result-types.js';
import { cliErrorFields, type CliErrorShape } from '../envelope.js';
import { SANDBOX_EGRESS_ERROR_MARKER } from './browser.js';
import { PROXY_TUNNEL_REJECTION_PATTERN } from './proxy.js';
import { getArtifactPath } from './storage.js';

/** Remap write-implying cache statuses when dry-run/read-only skipped persistence. */
export function reportCacheStatus(status: string, dryRun: boolean): string {
  if (!dryRun) return status;
  switch (status) {
    case 'miss':
      return 'would_fetch';
    case 'refreshed':
      return 'would_refresh';
    case 'revalidated':
      return 'would_revalidate';
    default:
      return status;
  }
}

/** Human spinner labels for reported (possibly remapped) cache statuses. */
export const FETCH_STATUS_LABEL: Record<string, string> = {
  hit: 'cached',
  miss: 'done',
  refreshed: 'refreshed',
  revalidated: 'revalidated',
  stale: 'served stale',
  would_fetch: 'previewed (not cached)',
  would_refresh: 'previewed refresh',
  would_revalidate: 'previewed revalidate',
};

export interface FetchResultInput {
  bin: string;
  url: string;
  normalizedUrl: string;
  cacheKey: string;
  storageDir: string;
  storageMode: StorageMode;
  cacheStatus: CacheHitStatus | string;
  freshnessState: FreshnessState | string;
  format: 'compressed' | 'detailed';
  artifact: {
    metadata: {
      capture_method: string;
      extraction_status: string;
      extraction_confidence: string;
      quality_notes: string[];
      fetched_at: string | null;
      validated_at: string | null;
      stale_after: string | null;
      artifact_type: string;
      docs_engine: string | null;
      docs_framework: string | null;
      source_doc_url: string | null;
      search_provider: string | null;
      token_estimate: { compressed: number | null; detailed: number | null };
    };
    compressed: string;
    detailed: string;
  };
  redirectedToGlobal: boolean;
  dryRun: boolean;
}

/** Machine-readable success/preview payload for one fetch URL. */
export function buildFetchResultData(input: FetchResultInput) {
  const { artifact, format, dryRun } = input;
  const content = format === 'compressed' ? artifact.compressed : artifact.detailed;
  return {
    schemaVersion: 1,
    command: input.bin,
    dryRun,
    cache: {
      key: input.cacheKey,
      // Preview runs must not claim a write landed.
      status: reportCacheStatus(input.cacheStatus, dryRun),
      freshness: input.freshnessState,
      path: getArtifactPath(input.storageDir, input.cacheKey),
      storage: input.storageMode,
      redirectedToGlobal: input.redirectedToGlobal,
    },
    source: {
      url: input.url,
      normalizedUrl: input.normalizedUrl,
      captureMethod: artifact.metadata.capture_method,
      extractionStatus: artifact.metadata.extraction_status,
      extractionConfidence: artifact.metadata.extraction_confidence,
      qualityNotes: artifact.metadata.quality_notes,
      fetchedAt: artifact.metadata.fetched_at,
      validatedAt: artifact.metadata.validated_at,
      staleAfter: artifact.metadata.stale_after,
    },
    artifactType: artifact.metadata.artifact_type,
    docsEngine: artifact.metadata.docs_engine,
    docsFramework: artifact.metadata.docs_framework,
    sourceDocUrl: artifact.metadata.source_doc_url,
    searchProvider: artifact.metadata.search_provider,
    format,
    tokenEstimate:
      format === 'compressed'
        ? artifact.metadata.token_estimate.compressed
        : artifact.metadata.token_estimate.detailed,
    content,
  };
}

export interface FetchFailureGuidance {
  suggestions?: string[];
  ref?: string;
}

/** Per-URL failure row for multi-URL batches — keeps prior successes in `data`. */
export function buildFetchFailureResult(input: {
  bin: string;
  url: string;
  dryRun: boolean;
  err: CliErrorShape;
  fallbackGuidance?: FetchFailureGuidance;
}) {
  const { bin, url, dryRun, err, fallbackGuidance } = input;
  // Prefer the throw site's suggestions/ref; otherwise attach fetch-specific recovery hints.
  const shaped = err.suggestions?.length || err.ref ? err : { ...err, ...fallbackGuidance };
  return {
    schemaVersion: 1,
    command: bin,
    dryRun,
    error: cliErrorFields(shaped, 'FETCH_FAILED'),
    cache: null,
    source: { url, normalizedUrl: null },
    content: null,
  };
}

/**
 * Shape a caught runtime error into a batch failure row (message + guidance).
 * CLIError rows should call {@link buildFetchFailureResult} directly so oclif fields are preserved.
 */
export function buildFetchFailureFromCaught(
  bin: string,
  url: string,
  err: unknown,
  dryRun: boolean
) {
  const message = describeError(err);
  return buildFetchFailureResult({
    bin,
    url,
    dryRun,
    err: { message, code: 'FETCH_FAILED' },
    fallbackGuidance: fetchFailureGuidance(message, url, bin),
  });
}

// How many `.cause` levels to walk. Real undici/Node transport errors nest at most 1-2 deep;
// the cap exists so a self-referential or cyclic `.cause` chain (Error.cause is an arbitrary,
// unvalidated property — nothing prevents `e.cause = e`, whether from a bug in this codebase or
// a dependency) can't hang the process, rather than being a limit expected to matter in practice.
const MAX_CAUSE_DEPTH = 10;

// Walks an Error's `.cause` chain and joins every message, deepest last. Node/undici's fetch
// throws a generic `TypeError: fetch failed` for transport-level failures, with the actionable
// detail (e.g. a proxy's tunnel rejection) nested one or two `.cause` levels down.
export function describeError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const parts = [err.message];
  let cause: unknown = err.cause;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && cause instanceof Error; depth++) {
    parts.push(cause.message);
    cause = cause.cause;
  }
  return parts.join(': ');
}

// Maps a runtime fetch failure to recovery steps keyed off its message. Returns undefined for
// unrecognized failures, which then surface with their original message and no extra hint. The
// patterns match the thrown text in fetcher.ts/browser.ts; keep them in sync if those messages
// change. Resolutions mirror the published troubleshooting guide.
export function fetchFailureGuidance(
  message: string,
  url: string,
  bin = 'bonsai'
): { suggestions: string[]; ref?: string } | undefined {
  const ref = 'https://bonsai.rhino-inquisitor.com/troubleshooting';
  // Name the pipe step explicitly: bare `import --stdin` blocks waiting for input, so a reader (or
  // an agent) running the hint verbatim would hang. Show the content being piped in from a file.
  const importHint = `Open it in a browser, save the page, then import it: cat page.md | ${bin} import ${url} --stdin`;

  // 401/403: an auth wall or anti-scraping WAF. Bonsai has no authenticated-fetch path in v1.
  if (/failed with status 40[13]\b/.test(message)) {
    return {
      suggestions: ['The page requires authentication or blocks automated requests.', importHint],
      ref,
    };
  }
  if (/failed with status 404\b/.test(message)) {
    return { suggestions: ['Check the URL is correct and the page still exists.'] };
  }
  if (/failed with status 5\d\d\b/.test(message)) {
    return {
      suggestions: ['The server returned an error. Retry later or verify the host is healthy.'],
    };
  }
  // Server returned a non-HTML body (JSON, binary, or no Content-Type at all). Scope the opener to
  // the real failure: --rendered does produce HTML, so "only scrapes HTML" would read as misleading.
  if (/Rejected content type|does not look like HTML/.test(message)) {
    return {
      suggestions: [
        'The server returned a non-HTML response (e.g. JSON or binary).',
        'If the page is rendered by client-side JavaScript, retry with --rendered.',
        importHint,
      ],
      ref,
    };
  }
  if (/DNS resolution failed/.test(message)) {
    return {
      suggestions: ['Check the hostname is spelled correctly and resolves on a public network.'],
    };
  }
  // Chrome's own network stack hit a proxy-enforced sandbox egress block (browser.ts's
  // describeNavigationFailure already explains the cause and the fix); only a workaround and the
  // docs ref are added here.
  if (message.includes(SANDBOX_EGRESS_ERROR_MARKER)) {
    return { suggestions: [importHint], ref };
  }
  // A configured proxy (HTTPS_PROXY/HTTP_PROXY) refused to tunnel to this host — distinct from
  // the destination's own 401/403 above, which is the site itself rejecting the request. Shared
  // with fetcher.ts's retry-fallback check so the two stay in sync by construction.
  if (PROXY_TUNNEL_REJECTION_PATTERN.test(message)) {
    return {
      suggestions: [
        "The configured proxy (HTTPS_PROXY/HTTP_PROXY) won't reach this host. Check its allowlist, or add the host to NO_PROXY to bypass the proxy for it.",
        importHint,
      ],
      ref,
    };
  }
  // The connection failed before any HTTP response was received — network-down, DNS, TLS, or a
  // proxy issue not specifically matched above. Node/undici's fetch reports all of these as a
  // generic "fetch failed" TypeError with no further suffix; the negative lookahead keeps this
  // from also matching assertOk's "Fetch failed with status NNN ..." (a real HTTP response was
  // received in that case, so it isn't a transport failure at all).
  if (/^fetch failed\b(?!\s+with status)/i.test(message)) {
    return {
      suggestions: [
        'The connection failed before a response was received. Check network connectivity and any HTTPS_PROXY/HTTP_PROXY/NO_PROXY settings.',
        importHint,
      ],
      ref,
    };
  }
  // A hostname that only resolves to a private/local IP at request time (literal private addresses
  // are rejected earlier with exit 2). Blocked to prevent SSRF; only public hosts can be fetched.
  if (/blocked local or private target/.test(message)) {
    return {
      suggestions: [
        'The hostname resolves to a private or local address, which is blocked to prevent SSRF. Only public http(s) hosts can be fetched.',
      ],
      ref,
    };
  }
  return undefined;
}
