import { parseHTML } from 'linkedom';
import type {
  DocsEngine,
  DocsFramework,
  MachineReadableArtifact,
  SearchCapability,
  SiteCapabilities,
  SourceHint,
} from './capabilities.js';
import { emptyCapabilities } from './capabilities.js';
import { parseGithubSourceLink } from './source-map.js';
import { extractNextRscData } from './rsc.js';

// Detects the documentation engine/framework behind a page from inert markup signals only — meta
// generators, framework global names, asset paths, and class hooks. It never executes page script;
// global markers (e.g. `window.__VP_HASH_MAP__`) are matched as substrings of the inert HTML.
// Search/source capabilities are emitted at most as `signal` here; dedicated probe/connector
// modules upgrade them to `verified` once an endpoint/index/raw URL is proven (T-24/T-25/T-19/T-20).

interface DetectContext {
  html: string;
  url: string;
  doc: any;
  generator: string;
}

type FamilyDetector = (ctx: DetectContext) => SiteCapabilities | null;

function getMetaGenerator(doc: any): string {
  const meta = doc.querySelector('meta[name="generator"]');
  return (meta?.getAttribute('content') || '').toLowerCase();
}

// True when a link is genuinely an "edit this page" link, not just any GitHub link on the page.
// Footer "Code of Conduct"/"License" links are `/blob/` links that must NOT be mistaken for the
// page source — that produced a wrong tiny artifact in live testing. Require the `/edit/` route, or
// an anchor whose class/text explicitly says edit.
function isPageEditLink(link: any, href: string): boolean {
  if (href.includes('/edit/')) return true;
  const cls = (link.getAttribute('class') || '').toString();
  const text = (link.textContent || '').trim();
  return (
    /edit[-_ ]?(?:this|on|page)|edit-link/i.test(cls) ||
    /edit (?:this )?page|edit on github/i.test(text)
  );
}

// Finds the page's edit/source link and turns it into a source hint. Only a `signal` until the raw
// URL is fetched/verified by the source-mapping layer (T-19).
function findEditLinkSource(doc: any): SourceHint | undefined {
  const links = doc.querySelectorAll('a[href]');
  for (const link of links) {
    const href = link.getAttribute('href') || '';
    if (!isPageEditLink(link, href)) continue;
    const parsed = parseGithubSourceLink(href);
    if (parsed) {
      return {
        type: parsed.path.endsWith('.mdx') ? 'mdx' : 'markdown',
        repository: parsed.repository,
        branch: parsed.branch,
        path: parsed.path,
        url: parsed.rawUrl,
        evidence: 'signal',
      };
    }
  }
  return undefined;
}

// An advertised llms.txt link/hint in the markup (managed platforms embed these). Conventional
// probing of llms.txt happens later (T-24); this only records what the page itself points to.
function findLlmsTxtSignal(ctx: DetectContext): MachineReadableArtifact | undefined {
  const match = ctx.html.match(/href=["']([^"']*llms(?:-full)?\.txt)["']/i);
  if (!match) return undefined;
  try {
    const resolved = new URL(match[1]!, ctx.url).toString();
    const type = /llms-full\.txt$/i.test(resolved) ? 'llms-full.txt' : 'llms.txt';
    return { type, url: resolved, evidence: 'signal' };
  } catch {
    return undefined;
  }
}

// Records search shape as a SIGNAL only. A visible button or a config blob is a lead, never proof
// (T-16/T-20). Connectors promote these to `verified` from fixtures.
function detectSearchSignal(ctx: DetectContext): SearchCapability | undefined {
  const h = ctx.html;
  // VitePress site data is embedded via JSON.parse("…") so quotes may be backslash-escaped.
  if (/__VP_SITE_DATA__/.test(h) && /\\?"provider\\?"\s*:\s*\\?"local\\?"/.test(h)) {
    return { provider: 'vitepress-local', evidence: 'signal' };
  }
  if (/docsearch/i.test(h) || /algolia/i.test(h)) {
    return { provider: 'algolia-docsearch', evidence: 'signal' };
  }
  if (/data-pagefind-body/.test(h)) {
    return { provider: 'pagefind', evidence: 'signal' };
  }
  return undefined;
}

function finalize(
  ctx: DetectContext,
  engine: DocsEngine | undefined,
  framework: DocsFramework | undefined,
  recommendedCapture: SiteCapabilities['recommendedCapture'],
  notes: string[]
): SiteCapabilities {
  const caps = emptyCapabilities();
  caps.docsEngine = engine;
  caps.framework = framework;
  caps.recommendedCapture = recommendedCapture;
  caps.notes = notes;

  const source = findEditLinkSource(ctx.doc);
  if (source) {
    caps.source = source;
    caps.machineReadable.push({ type: 'source-edit-link', url: source.url!, evidence: 'signal' });
  }
  const llms = findLlmsTxtSignal(ctx);
  if (llms) caps.machineReadable.push(llms);
  const search = detectSearchSignal(ctx);
  if (search) caps.search = search;
  return caps;
}

const detectVitePress: FamilyDetector = (ctx) => {
  if (!/__VP_HASH_MAP__|__VP_SITE_DATA__|class="[^"]*\bVPDoc\b/.test(ctx.html)) return null;
  return finalize(ctx, 'vitepress', undefined, 'static', ['detected VitePress globals (verified)']);
};

const detectStarlight: FamilyDetector = (ctx) => {
  // Starlight = Astro docs theme. Require its content markers; the Astro generator only strengthens
  // the note (a bare Astro site without Starlight markers is not a docs page we special-case).
  const starlightMarkers =
    /data-pagefind-body|sl-(?:doc-search|markdown-content|container)|starlight/i;
  if (!starlightMarkers.test(ctx.html)) return null;
  const note = ctx.generator.includes('astro')
    ? 'detected Astro Starlight (generator + markers, verified)'
    : 'detected Starlight markers (verified)';
  return finalize(ctx, 'starlight', undefined, 'static', [note]);
};

const detectDocusaurus: FamilyDetector = (ctx) => {
  if (
    !ctx.generator.includes('docusaurus') &&
    !/__docusaurus|theme-doc-|docusaurus/i.test(ctx.html)
  )
    return null;
  return finalize(ctx, 'docusaurus', undefined, 'static', [
    'detected Docusaurus markers (verified)',
  ]);
};

// Next/RSC frameworks: classify the framework first, then fall back to bare Next.
const detectNextFamily: FamilyDetector = (ctx) => {
  const isNext = /__NEXT_DATA__|\/_next\/static\/|self\.__next_f/.test(ctx.html);
  const gen = ctx.generator;
  let framework: DocsFramework | undefined;
  if (gen.includes('mintlify') || /mintlify/i.test(ctx.html)) framework = 'mintlify';
  else if (/nextra/i.test(ctx.html)) framework = 'nextra';
  else if (/fumadocs|fd-/i.test(ctx.html)) framework = 'fumadocs';
  if (!isNext && !framework) return null;
  const note = framework
    ? `detected Next.js + ${framework} (verified)`
    : 'detected Next.js docs/app (verified)';
  const caps = finalize(ctx, 'next', framework, 'static', [note]);

  // Recover the RSC/App Router page map and source-path hints (inert; never executed).
  const rsc = extractNextRscData(ctx.html);
  if (rsc.pageMap.length) caps.pageMap = rsc.pageMap;
  if (rsc.sourcePathHints.length) {
    caps.notes.push(
      `source-path hints (unverified): ${rsc.sourcePathHints.slice(0, 5).join(', ')}`
    );
  }
  return caps;
};

const detectMkDocs: FamilyDetector = (ctx) => {
  const gen = ctx.generator;
  if (!gen.includes('mkdocs') && !/mkdocs/i.test(ctx.html)) return null;
  const framework: DocsFramework = gen.includes('material') ? 'material-mkdocs' : 'mkdocs';
  return finalize(ctx, 'generated-static', framework, 'static', [
    `detected ${framework} (verified)`,
  ]);
};

const detectSphinx: FamilyDetector = (ctx) => {
  if (
    !ctx.generator.includes('sphinx') &&
    !/DOCUMENTATION_OPTIONS|searchindex\.js|documentation_options\.js|class="sphinxsidebar"/.test(
      ctx.html
    )
  )
    return null;
  return finalize(ctx, 'generated-static', 'sphinx', 'static', ['detected Sphinx (verified)']);
};

// Per-framework capability notes beyond the base "detected X" line. Kept out of the detector loop
// so the loop stays a flat match-and-return.
function managedFrameworkNotes(ctx: DetectContext, framework: DocsFramework): string[] {
  const notes = [`detected ${framework} (verified)`];
  if (framework === 'readme') {
    if (/algolia/i.test(ctx.html)) notes.push('ReadMe Algolia search metadata present (signal)');
    if (/openapi|oas/i.test(ctx.html)) notes.push('OpenAPI registry metadata present (signal)');
  }
  // Redocly did not expose llms.txt at the conventional path in research; do not assume one.
  if (framework === 'redocly') notes.push('llms.txt unverified at conventional path');
  return notes;
}

const detectManagedAndThemes: FamilyDetector = (ctx) => {
  const checks: Array<[RegExp, DocsFramework, DocsEngine | undefined]> = [
    [/gitbook/i, 'gitbook', undefined],
    [/readme(?:\.io|\.com)|data-rm-|\brm-Guides\b/i, 'readme', undefined],
    [/redocly|redoc/i, 'redocly', undefined],
    [/rspress/i, 'rspress', 'generated-static'],
    [/vuepress/i, 'vuepress', 'generated-static'],
    [/just-the-docs|search-data\.json/i, 'just-the-docs', 'generated-static'],
    [/td-(?:sidebar|content)|docsy/i, 'docsy', 'generated-static'],
  ];
  for (const [re, framework, engine] of checks) {
    if (re.test(ctx.html) || ctx.generator.includes(framework)) {
      return finalize(ctx, engine, framework, 'static', managedFrameworkNotes(ctx, framework));
    }
  }
  return null;
};

const detectDocsify: FamilyDetector = (ctx) => {
  if (!/\$docsify|docsify(?:\.min)?\.js|window\.\$docsify/i.test(ctx.html)) return null;
  // Docsify renders Markdown client-side; static HTML is an empty app shell, so prefer rendered
  // unless a source-Markdown mapping is found later (T-28).
  return finalize(ctx, 'spa', 'docsify', 'rendered', [
    'detected Docsify client-side Markdown renderer (verified)',
  ]);
};

// Last resort: tell a script-heavy empty SPA shell apart from a real static/generated doc page.
function detectGenericShape(ctx: DetectContext): SiteCapabilities {
  const bodyText = (ctx.doc.body?.textContent || '').trim();
  const scriptCount = ctx.doc.querySelectorAll('script').length;
  if (bodyText.length < 400 && scriptCount >= 3) {
    return finalize(ctx, 'spa', undefined, 'rendered', [
      'thin body with heavy script payload; SPA rendered candidate (signal)',
    ]);
  }
  const headings = ctx.doc.querySelectorAll('h1, h2, h3').length;
  if (headings >= 8) {
    return finalize(ctx, 'generated-static', undefined, 'static', [
      'long static reference shape (many headings) (signal)',
    ]);
  }
  return finalize(ctx, undefined, undefined, 'static', ['no docs-engine markers detected']);
}

const FAMILY_DETECTORS: FamilyDetector[] = [
  detectVitePress,
  detectStarlight,
  detectDocusaurus,
  detectMkDocs,
  detectSphinx,
  detectDocsify,
  detectNextFamily,
  detectManagedAndThemes,
];

/**
 * Inspects page HTML and returns the detected docs engine/framework plus any capability signals.
 * Always returns a result; an unrecognized page yields a best-effort static/SPA shape classification.
 */
export function detectDocsEngine(html: string, url: string): SiteCapabilities {
  const { document } = parseHTML(html);
  const ctx: DetectContext = { html, url, doc: document, generator: getMetaGenerator(document) };
  for (const detector of FAMILY_DETECTORS) {
    const result = detector(ctx);
    if (result) return result;
  }
  return detectGenericShape(ctx);
}
