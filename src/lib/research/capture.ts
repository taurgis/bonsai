import type { FetchResult } from './fetcher.js';
import type { ExtractionResult } from './extract.js';
import type { CaptureMethod } from './schema.js';
import type { MachineReadableArtifact, SiteCapabilities } from './docs/capabilities.js';
import { extractHtmlContent } from './extract.js';
import { detectDocsEngine } from './docs/detect.js';
import { emptyCapabilities } from './docs/capabilities.js';
import { probeRouteMarkdown, probeLlmsTxt, type TextFetcher } from './docs/machine-readable.js';
import { mapUrlToSource } from './docs/source-map.js';
import { extractFromSource } from './docs/markdown-source.js';
import { validateTextArtifact } from './docs/validate.js';

// Central content-capture orchestrator. Implements the Phase 2 preference order (GENERIC §3):
// machine-readable route Markdown / public source first, then static HTML, then an automatic
// rendered fallback for SPA/empty/low-quality pages (T-18). llms.txt is probed as discovery only.
// All fetchers are injected so the orchestration is unit-testable without network or a browser.

export interface CaptureDeps {
  fetchStatic: (url: string) => Promise<FetchResult>;
  fetchRendered: (url: string) => Promise<FetchResult>;
  fetchText: TextFetcher;
}

export interface CaptureOptions {
  forceRendered?: boolean;
}

export interface CaptureOutcome {
  fetchResult: FetchResult;
  extraction: ExtractionResult;
  capabilities: SiteCapabilities;
  captureMethod: CaptureMethod;
  sourceDocUrl: string | null;
  machineReadable: MachineReadableArtifact[];
  attemptedMethods: string[];
}

const MIN_USEFUL_CHARS = 600;

// A static extraction needs rendering help when it failed outright, the detector says the page is
// an SPA/client-rendered, or the extracted article is too thin/low-confidence to be useful.
export function renderedFallbackNeeded(
  caps: SiteCapabilities,
  extraction: ExtractionResult | null
): boolean {
  if (!extraction) return true;
  if (caps.recommendedCapture === 'rendered') return true;
  return extraction.confidence === 'low' && extraction.detailedMarkdown.length < MIN_USEFUL_CHARS;
}

// Tries route Markdown then a mapped raw source URL. Returns null when no source validates, so the
// caller falls back to HTML. Source content is always sanitized via extractFromSource.
interface ResolvedSource {
  extraction: ExtractionResult;
  method: CaptureMethod;
  url: string;
  mrType: MachineReadableArtifact['type'];
}

async function resolveSource(
  url: string,
  caps: SiteCapabilities,
  deps: CaptureDeps
): Promise<ResolvedSource | null> {
  const route = await probeRouteMarkdown(url, caps, deps.fetchText);
  if (route) {
    return {
      extraction: extractFromSource(route.body, route.artifact.url),
      method: 'route_markdown',
      url: route.artifact.url,
      mrType: 'route-markdown',
    };
  }

  const candidates: string[] = [];
  if (caps.source?.url) candidates.push(caps.source.url);
  const mapped = mapUrlToSource(url);
  if (mapped) candidates.push(mapped.rawUrl);

  for (const candidate of candidates) {
    try {
      const res = await deps.fetchText(candidate);
      if (res.status !== 304 && res.content && validateTextArtifact(res.content).ok) {
        return {
          extraction: extractFromSource(res.content, candidate),
          method: 'github_source',
          url: candidate,
          mrType: 'source-edit-link',
        };
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

async function discoverLlmsTxt(
  url: string,
  caps: SiteCapabilities,
  deps: CaptureDeps
): Promise<MachineReadableArtifact[]> {
  try {
    const llms = await probeLlmsTxt(url, caps, deps.fetchText);
    return llms ? [llms.artifact] : [];
  } catch {
    return [];
  }
}

async function captureRendered(
  url: string,
  deps: CaptureDeps
): Promise<{ fetchResult: FetchResult; extraction: ExtractionResult }> {
  const fetchResult = await deps.fetchRendered(url);
  return { fetchResult, extraction: extractHtmlContent(fetchResult.content, fetchResult.finalUrl) };
}

// Browser-rendered capture as a complete outcome. Shared by the forced-rendered path and the
// automatic fallback; appends 'browser_fallback' to attemptedMethods (mutated in place).
async function renderedOutcome(
  url: string,
  deps: CaptureDeps,
  attemptedMethods: string[],
  machineReadable: MachineReadableArtifact[]
): Promise<CaptureOutcome> {
  attemptedMethods.push('browser_fallback');
  const { fetchResult, extraction } = await captureRendered(url, deps);
  return {
    fetchResult,
    extraction,
    capabilities: detectDocsEngine(fetchResult.content, fetchResult.finalUrl),
    captureMethod: 'browser_fallback',
    sourceDocUrl: null,
    machineReadable: dedupeArtifacts(machineReadable),
    attemptedMethods,
  };
}

// Result of the static-fetch phase. A fetch failure is captured in staticError (not thrown) so the
// caller can still try a rendered fallback and, if that also fails, surface the original error.
interface StaticPhase {
  staticResult: FetchResult | null;
  capabilities: SiteCapabilities;
  machineReadable: MachineReadableArtifact[];
  staticError: Error | null;
}

// Static fetch + engine detection + llms.txt discovery. Never throws.
async function runStaticPhase(url: string, deps: CaptureDeps): Promise<StaticPhase> {
  let staticResult: FetchResult | null = null;
  let staticError: Error | null = null;
  try {
    staticResult = await deps.fetchStatic(url);
  } catch (err) {
    staticError = err as Error;
  }
  const capabilities = staticResult
    ? detectDocsEngine(staticResult.content, staticResult.finalUrl)
    : emptyCapabilities();
  const machineReadable = staticResult ? await discoverLlmsTxt(url, capabilities, deps) : [];
  return { staticResult, capabilities, machineReadable, staticError };
}

// Machine-readable / public-source capture, preferred over HTML extraction. Returns null (so the
// caller falls through to HTML/rendered) when there is no static page or no source validates.
async function sourceOutcome(
  url: string,
  phase: StaticPhase,
  deps: CaptureDeps,
  attemptedMethods: string[]
): Promise<CaptureOutcome | null> {
  if (!phase.staticResult) return null;
  const source = await resolveSource(url, phase.capabilities, deps);
  if (!source) return null;
  phase.machineReadable.push({ type: source.mrType, url: source.url, evidence: 'verified' });
  return {
    fetchResult: phase.staticResult,
    extraction: source.extraction,
    capabilities: phase.capabilities,
    captureMethod: source.method,
    sourceDocUrl: source.url,
    machineReadable: dedupeArtifacts(phase.machineReadable),
    attemptedMethods: [...attemptedMethods, source.method],
  };
}

// Rendered fallback when static extraction is missing or low quality. Returns null when no fallback
// is warranted; throws only when rendering fails and nothing usable was produced (preferring the
// earlier static error).
async function renderedFallbackOutcome(
  url: string,
  deps: CaptureDeps,
  attemptedMethods: string[],
  phase: StaticPhase,
  extraction: ExtractionResult | null
): Promise<CaptureOutcome | null> {
  if (!renderedFallbackNeeded(phase.capabilities, extraction)) return null;
  try {
    return await renderedOutcome(url, deps, attemptedMethods, phase.machineReadable);
  } catch (renderErr) {
    if (!extraction) throw phase.staticError ?? (renderErr as Error);
    return null;
  }
}

/**
 * Captures a page's best-available content. Order: forced rendered → route/source Markdown → static
 * HTML → rendered fallback. Returns the chosen fetch result, extraction, detected capabilities, and
 * provenance (capture method, source URL, machine-readable artifacts, attempted methods).
 */
export async function capturePage(
  url: string,
  options: CaptureOptions,
  deps: CaptureDeps
): Promise<CaptureOutcome> {
  const attemptedMethods: string[] = [];

  if (options.forceRendered) {
    return renderedOutcome(url, deps, attemptedMethods, []);
  }

  attemptedMethods.push('static_fetch');
  const phase = await runStaticPhase(url, deps);

  // Prefer machine-readable / public source before HTML extraction.
  const fromSource = await sourceOutcome(url, phase, deps, attemptedMethods);
  if (fromSource) return fromSource;

  let extraction: ExtractionResult | null = null;
  if (phase.staticResult) {
    try {
      extraction = extractHtmlContent(phase.staticResult.content, phase.staticResult.finalUrl);
    } catch (err) {
      phase.staticError = err as Error;
    }
  }

  const fallback = await renderedFallbackOutcome(url, deps, attemptedMethods, phase, extraction);
  if (fallback) return fallback;

  if (!extraction) throw phase.staticError ?? new Error(`Could not capture ${url}`);

  return {
    fetchResult: phase.staticResult!,
    extraction,
    capabilities: phase.capabilities,
    captureMethod: 'static_fetch',
    sourceDocUrl: null,
    machineReadable: dedupeArtifacts(phase.machineReadable),
    attemptedMethods,
  };
}

function dedupeArtifacts(items: MachineReadableArtifact[]): MachineReadableArtifact[] {
  const seen = new Set<string>();
  const out: MachineReadableArtifact[] = [];
  for (const item of items) {
    const key = `${item.type}:${item.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
