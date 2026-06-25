<script setup lang="ts">
/**
 * Animated hero: a tall tree built from characters of "documentation" text
 * prunes and compresses down into a compact bonsai — the same thing Bonsai
 * does to verbose docs to fit a token budget. A live token counter falls as
 * the surplus text is shed.
 *
 * SSR-safe: the server renders only the markup below. Every browser API
 * (canvas, requestAnimationFrame, ResizeObserver, matchMedia) is touched only
 * inside onMounted. https://vitepress.dev/guide/ssr-compat
 */
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { withBase } from 'vitepress';
import {
  GLYPH_POOL,
  centroid,
  drawBonsaiCanopy,
  drawBonsaiTrunkPot,
  drawTreeCanopy,
  drawTreeTrunk,
  readBonsaiColors,
  samplePoints,
  sortByDistance,
  subsample,
} from './lib/bonsai-canvas';

interface Particle {
  ch: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  scatterX: number;
  scatterY: number;
  driftX: number;
  driftY: number;
  kept: boolean;
  delay: number;
  color: string;
}

const wrapEl = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const tokens = ref(0);
const savings = ref(0);
const reduced = ref(false);
const ready = ref(false);

// The hero is a link to the page with real measured savings. withBase keeps the
// URL correct under the site's `base` ('/bonsai/'); it is a pure function, so it
// is safe on the server. https://vitepress.dev/reference/runtime-api#withbase
const examplesHref = withBase('/examples');
// Single accessible name for the link: describes both the decorative animation
// and where the link goes, so screen readers announce one meaningful control
// (the inner canvas is aria-hidden) rather than re-reading the ticking counter.
const linkLabel =
  'A large tree of text compressing into a small bonsai — how Bonsai prunes docs ' +
  'to fit a token budget. Open the example page with real before-and-after token savings.';

const ASSEMBLE = 900;
const HOLD = 450;
const COMPRESS = 1800;
const SETTLE = ASSEMBLE + HOLD + COMPRESS;
const MAX_PARTICLES = 720;

// Real measured averages from the agent comparison on /examples (captured
// 2026-06-25): the mean built-in web-fetch across 5 agents × 4 docs pages
// (37,905 tokens) vs Bonsai's compressed cache for the same pages (4,256) —
// an 89% reduction. The counter falls from one to the other as the tree
// compresses, so the headline savings are real, not decorative. See
// docs/examples.md for the per-agent, per-page figures behind these means.
const AVG_WEBFETCH_TOKENS = 37905;
const AVG_COMPRESSED_TOKENS = 4256;

let ctx: CanvasRenderingContext2D | null = null;
let raf = 0;
let particles: Particle[] = [];
let startTime = 0;
let startTokens = 0;
let endTokens = 0;
let lastTokenDisplay = -1;
let cssW = 0;
let cssH = 0;
let fontSize = 12;
let leaf = '#2f9e57';
let leafSoft = '#a8e6cf';
let bark = '#6f4a2f';
let ro: ResizeObserver | null = null;
let mo: MutationObserver | null = null;
let motionMq: MediaQueryList | null = null;
let motionHandler: ((ev: MediaQueryListEvent) => void) | null = null;
let darkMode = false;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function readColors(): void {
  const el = canvasRef.value;
  if (!el) return;
  const c = readBonsaiColors(el, { leaf, leafSoft, bark });
  leaf = c.leaf;
  leafSoft = c.leafSoft;
  bark = c.bark;
}

function build(): void {
  if (!cssW || !cssH) return;
  const step = Math.max(7, Math.round(cssW / 52));
  // Scale the glyph to the grid cell rather than adding a fixed offset, so the
  // tree stays equally dense at narrow mobile widths instead of overlapping.
  fontSize = Math.round(step * 1.3);

  let tree = subsample(
    samplePoints(cssW, cssH, step, 'leaf', (c) => drawTreeCanopy(c, cssW, cssH)).concat(
      samplePoints(cssW, cssH, step, 'bark', (c) => drawTreeTrunk(c, cssW, cssH)),
    ),
    MAX_PARTICLES,
  );
  let bonsai = samplePoints(cssW, cssH, step, 'leaf', (c) => drawBonsaiCanopy(c, cssW, cssH)).concat(
    samplePoints(cssW, cssH, step, 'bark', (c) => drawBonsaiTrunkPot(c, cssW, cssH)),
  );
  if (bonsai.length > tree.length) bonsai = subsample(bonsai, tree.length);
  if (!tree.length || !bonsai.length) return;

  // Inner points first: outermost tree text is the surplus that gets pruned,
  // and the kept inner text collapses toward the bonsai's core.
  const treeC = centroid(tree);
  const bonC = centroid(bonsai);
  tree = sortByDistance(tree, treeC);
  bonsai = sortByDistance(bonsai, bonC);

  const keptCount = bonsai.length;
  particles = tree.map((t, i): Particle => {
    const kept = i < keptCount;
    const dest = kept ? bonsai[i] : t;
    const kind = kept ? bonsai[i].kind : t.kind;
    const color = kind === 'bark' ? bark : i % 3 === 0 ? leafSoft : leaf;
    const ang = (i * 2.399) % (Math.PI * 2);
    return {
      ch: GLYPH_POOL[i % GLYPH_POOL.length],
      fromX: t.x,
      fromY: t.y,
      toX: dest.x,
      toY: dest.y,
      scatterX: t.x + Math.cos(ang) * cssW * 0.6,
      scatterY: t.y + Math.sin(ang) * cssH * 0.6,
      driftX: (t.x - treeC.x) * 0.4,
      driftY: -cssH * 0.18 - ((i % 7) * cssH) / 90,
      kept,
      delay: kept ? 0 : ((i * 53) % 100) / 200, // 0..0.5 staggered prune
      color,
    };
  });

  startTokens = AVG_WEBFETCH_TOKENS;
  endTokens = AVG_COMPRESSED_TOKENS;
  // Seed the visible count so the first paint shows the start value rather than
  // flashing "0" for one frame before the first requestAnimationFrame runs.
  lastTokenDisplay = Math.round(startTokens / 10) * 10;
  tokens.value = lastTokenDisplay;
  savings.value = 0;
  startTime = performance.now();
  ready.value = true;
}

function setTokens(value: number): void {
  const rounded = Math.round(value / 10) * 10;
  if (rounded !== lastTokenDisplay) {
    lastTokenDisplay = rounded;
    tokens.value = rounded;
    // Savings climbs from 0 to ~89% as the page compresses toward the cache.
    savings.value = startTokens > 0 ? Math.round((1 - value / startTokens) * 100) : 0;
  }
}

function setTextStyle(): void {
  if (!ctx) return;
  ctx.font = `bold ${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
}

function drawStatic(): void {
  if (!ctx) return;
  ctx.clearRect(0, 0, cssW, cssH);
  setTextStyle();
  for (const p of particles) {
    if (!p.kept) continue;
    ctx.fillStyle = p.color;
    ctx.fillText(p.ch, p.toX, p.toY);
  }
  setTokens(endTokens);
}

function frame(now: number): void {
  if (!ctx) return;
  const e = now - startTime;
  ctx.clearRect(0, 0, cssW, cssH);
  setTextStyle();

  const compress = e <= ASSEMBLE + HOLD ? 0 : clamp01((e - ASSEMBLE - HOLD) / COMPRESS);
  const assemble = easeInOut(clamp01(e / ASSEMBLE));
  const eased = easeInOut(compress);
  const swaying = e > SETTLE;

  for (const p of particles) {
    let x: number;
    let y: number;
    let alpha = 1;

    if (e < ASSEMBLE) {
      x = lerp(p.scatterX, p.fromX, assemble);
      y = lerp(p.scatterY, p.fromY, assemble);
      alpha = assemble;
    } else if (e < ASSEMBLE + HOLD) {
      x = p.fromX;
      y = p.fromY;
    } else if (p.kept) {
      x = lerp(p.fromX, p.toX, eased);
      y = lerp(p.fromY, p.toY, eased);
      if (swaying) {
        const s = (e - SETTLE) * 0.0012;
        x += Math.sin(s + p.toY * 0.03) * 0.9;
        y += Math.cos(s + p.toX * 0.02) * 0.7;
      }
    } else {
      const sp = clamp01((eased - p.delay) / (1 - p.delay));
      x = p.fromX + p.driftX * sp;
      y = p.fromY + p.driftY * sp;
      alpha = 1 - sp;
    }

    if (alpha <= 0.02) continue;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.fillText(p.ch, x, y);
  }
  ctx.globalAlpha = 1;

  setTokens(e < ASSEMBLE + HOLD ? startTokens : lerp(startTokens, endTokens, eased));
  raf = requestAnimationFrame(frame);
}

function start(): void {
  cancelAnimationFrame(raf);
  if (reduced.value) {
    drawStatic();
    return;
  }
  raf = requestAnimationFrame(frame);
}

function replay(): void {
  if (reduced.value) return;
  startTime = performance.now();
  start();
}

function resize(): void {
  const el = canvasRef.value;
  const wrap = wrapEl.value;
  if (!el || !wrap || !ctx) return;
  const width = wrap.clientWidth;
  // Ignore no-op fires: ResizeObserver re-triggers when we set the canvas
  // height below, and only the width drives our layout.
  if (!width || width === cssW) return;
  cssW = width;
  // Keep the canvas no taller than it is wide so it fits inside VitePress's
  // square hero image container on mobile instead of overflowing onto the title.
  cssH = Math.max(280, Math.min(width, 460));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  el.width = Math.round(cssW * dpr);
  el.height = Math.round(cssH * dpr);
  el.style.height = `${cssH}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  readColors();
  build();
  start();
}

function refreshColors(): void {
  // Rebuild from scratch so every particle picks up the new theme palette.
  readColors();
  build();
  start();
}

onMounted(() => {
  const el = canvasRef.value;
  if (!el) return;
  ctx = el.getContext('2d');
  if (!ctx) return;

  motionMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  reduced.value = motionMq.matches;
  motionHandler = (ev: MediaQueryListEvent) => {
    reduced.value = ev.matches;
    start();
  };
  motionMq.addEventListener('change', motionHandler);

  resize();

  ro = new ResizeObserver(() => resize());
  if (wrapEl.value) ro.observe(wrapEl.value);

  // VitePress toggles a `dark` class on <html>; rebuild the palette only when
  // the color mode actually flips, not on unrelated class mutations.
  darkMode = document.documentElement.classList.contains('dark');
  mo = new MutationObserver(() => {
    const nowDark = document.documentElement.classList.contains('dark');
    if (nowDark === darkMode) return;
    darkMode = nowDark;
    refreshColors();
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
  <div ref="wrapEl" class="bonsai-hero">
    <a class="bonsai-hero__link" :href="examplesHref" :aria-label="linkLabel">
      <canvas ref="canvasRef" class="bonsai-hero__canvas" aria-hidden="true" />
      <span v-show="ready" class="bonsai-hero__meta" aria-hidden="true">
        <span class="bonsai-hero__dot" />
        <span class="bonsai-hero__count">≈ {{ tokens.toLocaleString() }} tokens</span>
        <span v-show="savings > 0" class="bonsai-hero__save">{{ savings }}% smaller</span>
        <span class="bonsai-hero__cta">see the real numbers →</span>
      </span>
    </a>
    <button
      v-if="ready && !reduced"
      class="bonsai-hero__replay"
      type="button"
      aria-label="Replay animation"
      @click="replay"
    >
      ↺ replay
    </button>
  </div>
</template>

<style scoped>
.bonsai-hero {
  position: relative;
  width: 100%;
  max-width: 460px;
  margin: 0 auto;
}

.bonsai-hero__link {
  display: block;
  position: relative;
  color: inherit;
  text-decoration: none;
  cursor: pointer;
}

.bonsai-hero__canvas {
  display: block;
  width: 100%;
}

.bonsai-hero__meta {
  position: absolute;
  left: 50%;
  bottom: 6px;
  transform: translateX(-50%);
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 4px 8px;
  max-width: calc(100% - 24px);
  padding: 5px 12px;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  text-align: center;
}

/*
 * On phones the hero canvas spans the full viewport width, but the pill
 * shrink-wraps to its widest line, so its wrapped rows sit hugging the sides.
 * Let it fill the canvas width (the base max-width keeps a small screen inset)
 * so the centered rows gain even horizontal breathing room.
 * https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout/Aligning_items_in_a_flex_container
 */
@media (max-width: 639px) {
  .bonsai-hero__meta {
    display: flex;
    width: 100%;
  }
}

.bonsai-hero__save {
  padding: 1px 8px;
  font-weight: 700;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  border-radius: 999px;
}

.bonsai-hero__cta {
  color: var(--vp-c-brand-1);
  font-weight: 700;
}

.bonsai-hero__link:hover .bonsai-hero__cta,
.bonsai-hero__link:focus-visible .bonsai-hero__cta {
  text-decoration: underline;
}

.bonsai-hero__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--vp-c-brand-1);
  box-shadow: 0 0 0 4px var(--vp-c-brand-soft);
}

.bonsai-hero__replay {
  position: absolute;
  top: 4px;
  right: 4px;
  padding: 3px 10px;
  font-size: 12px;
  color: var(--vp-c-text-2);
  background: transparent;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.bonsai-hero:hover .bonsai-hero__replay,
.bonsai-hero:focus-within .bonsai-hero__replay {
  opacity: 1;
}

.bonsai-hero__replay:hover {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}
</style>
