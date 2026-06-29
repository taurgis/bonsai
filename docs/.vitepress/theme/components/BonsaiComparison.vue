<script setup lang="ts">
/**
 * One bonsai per AI coding agent, sized by how its native research workflow
 * compares to Bonsai. Each tree is drawn from the same text glyphs as the
 * hero: the kept inner foliage is what the agent usefully delivers, and the
 * faint outer ghost is the documentation it loses (to summarizing), defers
 * (to side artifacts), or never finds. Bonsai's cached official capture is the
 * 100% reference.
 *
 * Scores and headline stats come from /examples/agent-research-comparison —
 * three real research prompts (TanStack + React 19, SFCC chunk job step, React
 * RSC) run twice per agent (Bonsai workflow vs native web search). The score
 * weights official-source grounding, technical accuracy, and inline delivery —
 * not token count alone.
 *
 * SSR-safe: the server renders only the markup. Every browser API (canvas,
 * requestAnimationFrame, ResizeObserver, matchMedia, MutationObserver) is
 * touched only inside onMounted. https://vitepress.dev/guide/ssr-compat
 */
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { withBase } from 'vitepress';
import {
  GLYPH_POOL,
  centroid,
  drawBonsaiCanopy,
  drawBonsaiTrunkPot,
  readBonsaiColors,
  samplePoints,
  sortByDistance,
} from './lib/bonsai-canvas';

interface Agent {
  key: string;
  name: string;
  score: number;
  tag: string;
  note: string;
}

interface Glyph {
  x: number;
  y: number;
  ch: string;
  color: string;
  delay: number;
}

interface Scene {
  el: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cssW: number;
  cssH: number;
  fontSize: number;
  score: number;
  kept: Glyph[];
  lost: Glyph[];
  bark: Glyph[];
}

// Ordered best → worst native research score. Figures from agent-research-comparison
// (2026-06-29): three prompts × four agents, Bonsai workflow vs native search.
const agents: Agent[] = [
  {
    key: 'cursor',
    name: 'Cursor',
    score: 76,
    tag: 'grounded',
    note: 'SFCC native (16k) was deployable via mirror; Bonsai (30k) cached the official Salesforce guide. TanStack and RSC native runs were often cheaper with comparable inline depth.',
  },
  {
    key: 'claude',
    name: 'Claude Code',
    score: 68,
    tag: 'mixed',
    note: 'Deepest TanStack answer — after an 83.5k-token recovery from a failed workflow. SFCC native was cheapest among the original three (32.5k) but still wrong on steptypes.json.',
  },
  {
    key: 'codex',
    name: 'Codex',
    score: 52,
    tag: 'misses hard docs',
    note: 'Solid TanStack and RSC overviews, but SFCC burned ~80k tokens with no usable answer. Bonsai runs cost more when they capture more official pages (+24% on TanStack).',
  },
  {
    key: 'antigravity',
    name: 'Antigravity',
    score: 45,
    tag: 'deferred',
    note: 'Lowest context on SFCC (3.4%) — and still mock data plus invalid status returns. Depth often lives in brain artifacts while the chat stays short.',
  },
];

// Headline stats — quality and provenance, not token savings.
const researchStats = [
  {
    label: 'Mainstream docs (TanStack, RSC)',
    value: 'Native often matches inline depth',
    contrast: 'Comparable answers — Bonsai adds pages on disk',
  },
  {
    label: 'Enterprise docs (client-rendered)',
    value: 'Native often wrong or empty',
    contrast: 'Codex ~80k tokens, no answer; schema bugs in others',
  },
  {
    label: 'Grounding per session',
    value: '12/12 Bonsai runs cached official pages',
    contrast: '0/12 native — snippets, mirrors, or nothing to inspect',
  },
] as const;

const researchHref = withBase('/examples/agent-research-comparison');
const sfccHref = withBase(
  '/examples/agent-research-comparison#scenario-2-salesforce-b2c-commerce-chunk-oriented-job-step',
);

const wrapEl = ref<HTMLElement | null>(null);
const reduced = ref(false);

const canvases: (HTMLCanvasElement | null)[] = [];
let scenes: Scene[] = [];
let raf = 0;
let startTime = 0;
let leaf = '#2f9e57';
let leafSoft = '#a8e6cf';
let bark = '#6f4a2f';
let ghost = 'rgba(130,130,130,0.18)';
let ro: ResizeObserver | null = null;
let mo: MutationObserver | null = null;
let motionMq: MediaQueryList | null = null;
let motionHandler: ((ev: MediaQueryListEvent) => void) | null = null;
let darkMode = false;

const ENTRANCE = 1100;
const GHOST_ALPHA = 0.18;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

function setCanvas(index: number, el: Element | null): void {
  canvases[index] = el instanceof HTMLCanvasElement ? el : null;
}

function readColors(): void {
  const el = wrapEl.value;
  if (!el) return;
  const c = readBonsaiColors(el, { leaf, leafSoft, bark });
  leaf = c.leaf;
  leafSoft = c.leafSoft;
  bark = c.bark;
  const text3 = getComputedStyle(el).getPropertyValue('--vp-c-text-3').trim();
  if (text3) ghost = text3;
}

/** Sample one bonsai and split its canopy into kept (delivered) vs lost glyphs. */
function buildScene(el: HTMLCanvasElement, score: number): Scene | null {
  const ctx = el.getContext('2d');
  const cssW = el.clientWidth;
  const cssH = el.clientHeight;
  if (!ctx || !cssW || !cssH) return null;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  el.width = Math.round(cssW * dpr);
  el.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const step = Math.max(5, Math.round(cssW / 30));
  const fontSize = step + 3;

  const canopyRaw = samplePoints(cssW, cssH, step, 'leaf', (c) => drawBonsaiCanopy(c, cssW, cssH));
  const barkRaw = samplePoints(cssW, cssH, step, 'bark', (c) => drawBonsaiTrunkPot(c, cssW, cssH));
  if (!canopyRaw.length) return null;

  // Inner-first: the kept core is a compact, healthy bonsai; the pruned outer
  // fringe becomes the faint ghost of the docs the agent never delivers.
  const canopy = sortByDistance(canopyRaw, centroid(canopyRaw));
  const keptCount = Math.round((canopy.length * score) / 100);
  const pool = GLYPH_POOL.length;

  const kept: Glyph[] = canopy.slice(0, keptCount).map((p, i) => ({
    x: p.x,
    y: p.y,
    ch: GLYPH_POOL[i % pool],
    color: i % 3 === 0 ? leafSoft : leaf,
    delay: keptCount > 1 ? (i / keptCount) * 0.55 : 0,
  }));
  const lost: Glyph[] = canopy.slice(keptCount).map((p, i) => ({
    x: p.x,
    y: p.y,
    ch: GLYPH_POOL[(i + keptCount) % pool],
    color: ghost,
    delay: 0,
  }));
  const barkGlyphs: Glyph[] = barkRaw.map((p, i) => ({
    x: p.x,
    y: p.y,
    ch: GLYPH_POOL[i % pool],
    color: bark,
    delay: 0,
  }));

  return { el, ctx, cssW, cssH, fontSize, score, kept, lost, bark: barkGlyphs };
}

function drawScene(s: Scene, progress: number): void {
  const { ctx } = s;
  ctx.clearRect(0, 0, s.cssW, s.cssH);
  ctx.font = `bold ${s.fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Ghost of the lost documentation, faint behind everything.
  ctx.globalAlpha = GHOST_ALPHA * progress;
  ctx.fillStyle = ghost;
  for (const g of s.lost) ctx.fillText(g.ch, g.x, g.y);

  // Trunk and pot fade in together.
  ctx.globalAlpha = progress;
  ctx.fillStyle = bark;
  for (const b of s.bark) ctx.fillText(b.ch, b.x, b.y);

  // Kept foliage rises into place, staggered from the core outward.
  for (const k of s.kept) {
    const local = clamp01((progress - k.delay) / Math.max(0.001, 1 - k.delay));
    if (local <= 0.02) continue;
    ctx.globalAlpha = local;
    ctx.fillStyle = k.color;
    ctx.fillText(k.ch, k.x, k.y + (1 - local) * 6);
  }
  ctx.globalAlpha = 1;
}

function buildAll(): void {
  scenes = [];
  canvases.forEach((el, i) => {
    if (!el) return;
    const scene = buildScene(el, agents[i].score);
    if (scene) scenes.push(scene);
  });
}

function drawAll(progress: number): void {
  for (const s of scenes) drawScene(s, progress);
}

function tick(now: number): void {
  const e = easeInOut(clamp01((now - startTime) / ENTRANCE));
  drawAll(e);
  if (e < 1) {
    raf = requestAnimationFrame(tick);
  } else {
    drawAll(1); // settle on the final frame, then stop — no perpetual loop
  }
}

function play(): void {
  cancelAnimationFrame(raf);
  if (reduced.value) {
    drawAll(1);
    return;
  }
  startTime = performance.now();
  raf = requestAnimationFrame(tick);
}

let lastWidth = 0;
function relayout(): void {
  const wrap = wrapEl.value;
  if (!wrap) return;
  const width = wrap.clientWidth;
  if (!width || width === lastWidth) return; // ignore RO echoes from our own canvas sizing
  lastWidth = width;
  buildAll();
  play();
}

onMounted(() => {
  motionMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  reduced.value = motionMq.matches;
  motionHandler = (ev: MediaQueryListEvent) => {
    reduced.value = ev.matches;
    play();
  };
  motionMq.addEventListener('change', motionHandler);

  readColors();
  lastWidth = wrapEl.value?.clientWidth ?? 0;
  buildAll();
  play();

  ro = new ResizeObserver(() => relayout());
  if (wrapEl.value) ro.observe(wrapEl.value);

  // Rebuild the palette only when VitePress actually flips the color mode.
  darkMode = document.documentElement.classList.contains('dark');
  mo = new MutationObserver(() => {
    const nowDark = document.documentElement.classList.contains('dark');
    if (nowDark === darkMode) return;
    darkMode = nowDark;
    readColors();
    buildAll();
    play();
  });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
});

onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  ro?.disconnect();
  mo?.disconnect();
  if (motionMq && motionHandler) motionMq.removeEventListener('change', motionHandler);
});
</script>

<template>
  <section class="bonsai-cmp" aria-labelledby="bonsai-cmp-title">
    <div ref="wrapEl" class="bonsai-cmp__container">
      <div class="bonsai-cmp__head">
        <h2 id="bonsai-cmp-title" class="bonsai-cmp__title">More tokens sometimes. Better sources almost always.</h2>
        <p class="bonsai-cmp__sub">
          Three prompts, four agents: native web search vs the Bonsai workflow.
          Scores weight <strong>official-source grounding</strong>, technical accuracy,
          and inline delivery — not who spent fewer tokens. On the SFCC prompt, Codex
          burned ~80k native tokens for no answer; Bonsai captured the official guide.
          <a class="bonsai-cmp__link" :href="researchHref">Session benchmarks →</a>
          <span class="bonsai-cmp__sep">·</span>
          <a class="bonsai-cmp__link" :href="sfccHref">SFCC scenario →</a>
        </p>
      </div>

      <dl class="bonsai-cmp__stats">
        <div v-for="s in researchStats" :key="s.label" class="bonsai-cmp__stat">
          <dt class="bonsai-cmp__stat-label">{{ s.label }}</dt>
          <dd class="bonsai-cmp__stat-value">{{ s.value }}</dd>
          <dd class="bonsai-cmp__stat-contrast">{{ s.contrast }}</dd>
        </div>
      </dl>

      <ul class="bonsai-cmp__grid">
        <li v-for="(a, i) in agents" :key="a.key" class="bonsai-cmp__card">
          <div class="bonsai-cmp__canvas-wrap">
            <canvas :ref="(el) => setCanvas(i, el as Element | null)" class="bonsai-cmp__canvas" aria-hidden="true" />
          </div>
          <div class="bonsai-cmp__row">
            <span class="bonsai-cmp__name">{{ a.name }}</span>
            <span class="bonsai-cmp__tag" :data-tag="a.tag">{{ a.tag }}</span>
          </div>
          <div class="bonsai-cmp__score">
            <span class="bonsai-cmp__pct">{{ a.score }}</span><span class="bonsai-cmp__unit">%</span>
            <span class="bonsai-cmp__label">research grounding</span>
          </div>
          <div class="bonsai-cmp__bar" aria-hidden="true">
            <span class="bonsai-cmp__bar-fill" :style="{ width: a.score + '%' }" />
          </div>
          <p class="bonsai-cmp__note">{{ a.note }}</p>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
/* Match VPHero / VPFeatures: outer padding breakpoints, inner 1152px container. */
.bonsai-cmp {
  margin: 24px auto 64px;
  padding: 0 24px;
}

@media (min-width: 640px) {
  .bonsai-cmp {
    padding: 0 48px;
  }
}

@media (min-width: 960px) {
  .bonsai-cmp {
    padding: 0 64px;
  }
}

.bonsai-cmp__container {
  max-width: 1152px;
  margin: 0 auto;
}

.bonsai-cmp__head {
  text-align: center;
  max-width: 760px;
  margin: 0 auto 28px;
}

.bonsai-cmp__title {
  margin: 0 0 10px;
  font-size: clamp(22px, 3.4vw, 30px);
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
  border: 0;
  padding: 0;
}

.bonsai-cmp__sub {
  margin: 0;
  font-size: 15px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}

.bonsai-cmp__link {
  font-weight: 600;
  color: var(--vp-c-brand-1);
  white-space: nowrap;
}

.bonsai-cmp__sep {
  margin: 0 0.35em;
  color: var(--vp-c-text-3);
}

.bonsai-cmp__stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin: 0 0 28px;
  padding: 0;
}

.bonsai-cmp__stat {
  margin: 0;
  padding: 14px 16px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
}

.bonsai-cmp__stat-label {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
}

.bonsai-cmp__stat-value {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.35;
  color: var(--vp-c-text-1);
}

.bonsai-cmp__stat-contrast {
  margin: 4px 0 0;
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--vp-c-text-2);
}

.bonsai-cmp__grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.bonsai-cmp__card {
  display: flex;
  flex-direction: column;
  padding: 16px 16px 18px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 14px;
  transition:
    border-color 0.2s ease,
    transform 0.2s ease;
}

.bonsai-cmp__card:hover {
  border-color: var(--vp-c-brand-1);
  transform: translateY(-2px);
}

.bonsai-cmp__canvas-wrap {
  margin: -4px 0 6px;
}

.bonsai-cmp__canvas {
  display: block;
  /* Cap the width and pin the aspect ratio so the tree keeps its shape in a
     full-width mobile card instead of stretching horizontally. */
  width: 100%;
  max-width: 184px;
  aspect-ratio: 7 / 5;
  margin: 0 auto;
}

.bonsai-cmp__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.bonsai-cmp__name {
  font-weight: 700;
  font-size: 15px;
  color: var(--vp-c-text-1);
}

.bonsai-cmp__tag {
  flex: none;
  padding: 2px 8px;
  font-family: var(--vp-font-family-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--vp-c-text-2);
  background: var(--vp-c-default-soft);
  border-radius: 999px;
}

.bonsai-cmp__tag[data-tag='grounded'],
.bonsai-cmp__tag[data-tag='efficient'] {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.bonsai-cmp__tag[data-tag='mixed'] {
  color: var(--vp-c-warning-1);
  background: var(--vp-c-warning-soft);
}

.bonsai-cmp__tag[data-tag='misses hard docs'],
.bonsai-cmp__tag[data-tag='deferred'] {
  color: var(--vp-c-danger-1);
  background: var(--vp-c-danger-soft);
}

.bonsai-cmp__score {
  display: flex;
  align-items: baseline;
  gap: 3px;
  margin-top: 10px;
}

.bonsai-cmp__pct {
  font-size: 26px;
  font-weight: 800;
  line-height: 1;
  color: var(--vp-c-brand-1);
}

.bonsai-cmp__unit {
  font-size: 14px;
  font-weight: 700;
  color: var(--vp-c-brand-1);
}

.bonsai-cmp__label {
  margin-left: auto;
  font-size: 11px;
  color: var(--vp-c-text-3);
}

.bonsai-cmp__bar {
  margin: 8px 0 12px;
  height: 5px;
  border-radius: 999px;
  background: var(--vp-c-default-soft);
  overflow: hidden;
}

.bonsai-cmp__bar-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--vp-c-brand-3), var(--vp-c-brand-1));
}

.bonsai-cmp__note {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--vp-c-text-2);
}

@media (max-width: 960px) {
  .bonsai-cmp__stats {
    grid-template-columns: 1fr;
  }
  .bonsai-cmp__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 520px) {
  .bonsai-cmp__grid {
    grid-template-columns: 1fr;
  }
}
</style>
