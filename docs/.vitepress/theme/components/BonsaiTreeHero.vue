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

type Kind = 'leaf' | 'bark';
interface Pt {
  x: number;
  y: number;
  kind: Kind;
}
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
const reduced = ref(false);
const ready = ref(false);

// Static so screen readers describe the visual once, rather than re-announcing
// every time the decorative token counter ticks.
const ariaLabel =
  'Animation of a large tree made of text compressing down into a small bonsai tree, ' +
  'representing how Bonsai prunes documentation to fit a token budget.';

// Letters only, so every particle is a visible glyph.
const POOL =
  'BonsaiFetchesThePageExtractsTheMainArticleConvertsItToMarkdownSanitizesUnsafeMarkup' +
  'EstimatesTokensPrunesProseKeepsHeadingsCodeTablesAndListsThenCachesTheResultSoAgents' +
  'ReuseItInsteadOfScrapingAgainCompressedDetailedFreshStaleRevalidateEtagLastModified'.split(
    '',
  );

const ASSEMBLE = 900;
const HOLD = 450;
const COMPRESS = 1800;
const SETTLE = ASSEMBLE + HOLD + COMPRESS;
const MAX_PARTICLES = 720;
const TOKENS_PER_GLYPH = 8;

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
  const cs = getComputedStyle(el);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  leaf = v('--bonsai-leaf', leaf);
  leafSoft = v('--bonsai-leaf-soft', leafSoft);
  bark = v('--bonsai-bark', bark);
}

/** Draw `drawFn` to an offscreen canvas and return one point per filled grid cell. */
function samplePoints(
  w: number,
  h: number,
  step: number,
  kind: Kind,
  drawFn: (c: CanvasRenderingContext2D) => void,
): Pt[] {
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const octx = off.getContext('2d');
  if (!octx) return [];
  octx.fillStyle = '#000';
  octx.strokeStyle = '#000';
  drawFn(octx);
  const data = octx.getImageData(0, 0, w, h).data;
  const pts: Pt[] = [];
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      if (data[(y * w + x) * 4 + 3] > 128) pts.push({ x, y, kind });
    }
  }
  return pts;
}

function blobs(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, specs: number[][]): void {
  c.beginPath();
  for (const [dx, dy, br] of specs) {
    c.moveTo(cx + dx * r + br * r, cy + dy * r);
    c.arc(cx + dx * r, cy + dy * r, br * r, 0, Math.PI * 2);
  }
  c.fill();
}

function drawTreeCanopy(c: CanvasRenderingContext2D, w: number, h: number): void {
  blobs(c, w * 0.5, h * 0.32, Math.min(w, h) * 0.3, [
    [0, 0, 1],
    [-0.6, 0.18, 0.62],
    [0.6, 0.14, 0.64],
    [-0.32, -0.4, 0.56],
    [0.34, -0.36, 0.56],
    [0, 0.4, 0.6],
  ]);
}

function drawTreeTrunk(c: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w * 0.5;
  c.beginPath();
  c.moveTo(cx - w * 0.06, h * 0.98);
  c.lineTo(cx - w * 0.022, h * 0.4);
  c.lineTo(cx + w * 0.022, h * 0.4);
  c.lineTo(cx + w * 0.06, h * 0.98);
  c.closePath();
  c.fill();
}

function drawBonsaiCanopy(c: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w * 0.5;
  const cy = h * 0.4;
  const pads: number[][] = [
    [0, 0, 0.22, 0.1],
    [-0.21, 0.04, 0.12, 0.06],
    [0.22, -0.01, 0.13, 0.07],
    [0.02, -0.11, 0.12, 0.06],
  ];
  for (const [dx, dy, rx, ry] of pads) {
    c.beginPath();
    c.ellipse(cx + dx * w, cy + dy * h * 1.4, rx * w, ry * h, 0, 0, Math.PI * 2);
    c.fill();
  }
}

function drawBonsaiTrunkPot(c: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w * 0.5;
  // trunk
  c.lineWidth = w * 0.05;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(cx, h * 0.78);
  c.quadraticCurveTo(cx - w * 0.12, h * 0.62, cx - w * 0.05, h * 0.48);
  c.stroke();
  // a low branch
  c.lineWidth = w * 0.03;
  c.beginPath();
  c.moveTo(cx - w * 0.04, h * 0.66);
  c.quadraticCurveTo(cx + w * 0.12, h * 0.62, cx + w * 0.18, h * 0.52);
  c.stroke();
  // pot
  c.beginPath();
  c.moveTo(cx - w * 0.2, h * 0.79);
  c.lineTo(cx + w * 0.2, h * 0.79);
  c.lineTo(cx + w * 0.13, h * 0.93);
  c.lineTo(cx - w * 0.13, h * 0.93);
  c.closePath();
  c.fill();
  c.fillRect(cx - w * 0.22, h * 0.76, w * 0.44, h * 0.04);
}

function subsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const out: T[] = [];
  const stride = arr.length / max;
  for (let i = 0; i < max; i++) out.push(arr[Math.floor(i * stride)]);
  return out;
}

function centroid(pts: Pt[]): { x: number; y: number } {
  let sx = 0;
  let sy = 0;
  for (const p of pts) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / pts.length, y: sy / pts.length };
}

function build(): void {
  if (!cssW || !cssH) return;
  const step = Math.max(6, Math.round(cssW / 52));
  fontSize = step + 4;

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
  const byDist = (c: { x: number; y: number }) => (a: Pt, b: Pt) =>
    (a.x - c.x) ** 2 + (a.y - c.y) ** 2 - ((b.x - c.x) ** 2 + (b.y - c.y) ** 2);
  tree = tree.slice().sort(byDist(treeC));
  bonsai = bonsai.slice().sort(byDist(bonC));

  const keptCount = bonsai.length;
  particles = tree.map((t, i): Particle => {
    const kept = i < keptCount;
    const dest = kept ? bonsai[i] : t;
    const kind = kept ? bonsai[i].kind : t.kind;
    const color = kind === 'bark' ? bark : i % 3 === 0 ? leafSoft : leaf;
    const ang = (i * 2.399) % (Math.PI * 2);
    return {
      ch: POOL[i % POOL.length],
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

  startTokens = tree.length * TOKENS_PER_GLYPH;
  endTokens = keptCount * TOKENS_PER_GLYPH;
  // Seed the visible count so the first paint shows the start value rather than
  // flashing "0" for one frame before the first requestAnimationFrame runs.
  lastTokenDisplay = Math.round(startTokens / 10) * 10;
  tokens.value = lastTokenDisplay;
  startTime = performance.now();
  ready.value = true;
}

function setTokens(value: number): void {
  const rounded = Math.round(value / 10) * 10;
  if (rounded !== lastTokenDisplay) {
    lastTokenDisplay = rounded;
    tokens.value = rounded;
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
  cssH = Math.max(320, Math.min(Math.round(width * 1.04), 460));
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
    <canvas
      ref="canvasRef"
      class="bonsai-hero__canvas"
      role="img"
      :aria-label="ariaLabel"
      @click="replay"
    />
    <div v-show="ready" class="bonsai-hero__meta" aria-hidden="true">
      <span class="bonsai-hero__dot" />
      <span class="bonsai-hero__count">≈ {{ tokens.toLocaleString() }} tokens</span>
    </div>
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

.bonsai-hero__canvas {
  display: block;
  width: 100%;
  cursor: pointer;
}

.bonsai-hero__meta {
  position: absolute;
  left: 50%;
  bottom: 6px;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  white-space: nowrap;
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

.bonsai-hero:hover .bonsai-hero__replay {
  opacity: 1;
}

.bonsai-hero__replay:hover {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}
</style>
