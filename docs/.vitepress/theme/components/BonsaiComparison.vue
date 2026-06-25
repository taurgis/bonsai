<script setup lang="ts">
/**
 * One bonsai per AI coding agent, sized by how its built-in web fetch compares
 * to Bonsai. Each tree is drawn from the same text glyphs as the hero: the
 * kept inner foliage is what the agent usefully delivers, and the faint outer
 * ghost is the documentation it loses (to summarizing) or buries (in page
 * chrome). Bonsai's own clean, cached capture is the 100% reference.
 *
 * The score is a composite "context-efficiency" judgement that blends two
 * measured failure modes from /examples — dropped content and token bloat —
 * into a single comparable number. The hard per-page figures live on that page.
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

// Ordered best → worst. Scores are a composite of the measured numbers on the
// examples page (completeness + token leanness vs Bonsai's clean capture).
const agents: Agent[] = [
  {
    key: 'codex',
    name: 'Codex',
    score: 75,
    tag: 'chrome',
    note: 'Readable, near-complete text — but it carries docs chrome and leaves nothing cached for the next agent.',
  },
  {
    key: 'cursor',
    name: 'Cursor',
    score: 68,
    tag: 'partial',
    note: 'Deterministic Markdown, yet it drops structured callouts and still runs larger than Bonsai.',
  },
  {
    key: 'claude',
    name: 'Claude Code',
    score: 45,
    tag: 'lossy',
    note: 'A model summarizes the page — silently shedding a third to four-fifths of long docs, and it can refuse outright.',
  },
  {
    key: 'mistral',
    name: 'Mistral Vibe',
    score: 30,
    tag: 'bloat',
    note: 'The whole page is converted verbatim: complete, but 4–60× the tokens in navigation and footers.',
  },
  {
    key: 'antigravity',
    name: 'Antigravity',
    score: 20,
    tag: 'raw HTML',
    note: 'Dumps raw HTML — scripts, styles, and all — and misses client-rendered docs entirely.',
  },
];

const examplesHref = withBase('/examples');

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
  <section ref="wrapEl" class="bonsai-cmp" aria-labelledby="bonsai-cmp-title">
    <div class="bonsai-cmp__head">
      <h2 id="bonsai-cmp-title" class="bonsai-cmp__title">Every agent reads the web. None keep it like Bonsai.</h2>
      <p class="bonsai-cmp__sub">
        Each agent's built-in web fetch, scored on <strong>context efficiency</strong> — how much
        complete documentation it delivers per token — against Bonsai's clean, cached capture (the
        full 100% bonsai).
        <a class="bonsai-cmp__link" :href="examplesHref">See the measured numbers →</a>
      </p>
    </div>

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
          <span class="bonsai-cmp__label">context kept</span>
        </div>
        <div class="bonsai-cmp__bar" aria-hidden="true">
          <span class="bonsai-cmp__bar-fill" :style="{ width: a.score + '%' }" />
        </div>
        <p class="bonsai-cmp__note">{{ a.note }}</p>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.bonsai-cmp {
  max-width: 1152px;
  margin: 24px auto 64px;
  padding: 0 24px;
}

.bonsai-cmp__head {
  text-align: center;
  max-width: 760px;
  margin: 0 auto 32px;
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

.bonsai-cmp__grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
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

/* Failure-mode hue: loss runs warm, bloat runs neutral-heavy. */
.bonsai-cmp__tag[data-tag='lossy'],
.bonsai-cmp__tag[data-tag='partial'] {
  color: var(--vp-c-warning-1);
  background: var(--vp-c-warning-soft);
}

.bonsai-cmp__tag[data-tag='bloat'],
.bonsai-cmp__tag[data-tag='raw HTML'] {
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
  .bonsai-cmp__grid {
    grid-template-columns: repeat(2, 1fr);
  }
  /* Best agent spans the full first row so the ranking still reads top-down. */
  .bonsai-cmp__card:first-child {
    grid-column: 1 / -1;
  }
}

@media (max-width: 520px) {
  .bonsai-cmp {
    padding: 0 16px;
  }
  .bonsai-cmp__grid {
    grid-template-columns: 1fr;
  }
  .bonsai-cmp__card:first-child {
    grid-column: auto;
  }
}
</style>
