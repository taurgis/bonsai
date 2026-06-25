/**
 * Shared canvas primitives for the glyph-bonsai visuals.
 *
 * Both the home hero (one tree compressing into one bonsai) and the agent
 * comparison (one bonsai per agent, sized by its context-efficiency score)
 * draw the same bonsai silhouette out of text glyphs, so the shape sampling,
 * the bonsai draw functions, and the palette reader live here once.
 *
 * These are pure drawing/geometry helpers — no Vue, no lifecycle, no browser
 * globals beyond the 2D canvas context the caller already owns. They are only
 * ever called from inside onMounted, so SSR never touches them.
 * https://vitepress.dev/guide/ssr-compat
 */

export type Kind = 'leaf' | 'bark';

export interface Pt {
  x: number;
  y: number;
  kind: Kind;
}

export interface BonsaiColors {
  leaf: string;
  leafSoft: string;
  bark: string;
}

/**
 * Letters only, so every sampled grid cell maps to a visible glyph. The split
 * wraps the whole concatenation — splitting just the last literal would coerce
 * the others through `String + Array` and pepper the pool with commas.
 */
export const GLYPH_POOL = (
  'BonsaiFetchesThePageExtractsTheMainArticleConvertsItToMarkdownSanitizesUnsafeMarkup' +
  'EstimatesTokensPrunesProseKeepsHeadingsCodeTablesAndListsThenCachesTheResultSoAgents' +
  'ReuseItInsteadOfScrapingAgainCompressedDetailedFreshStaleRevalidateEtagLastModified'
).split('');

/** Draw `drawFn` to an offscreen canvas and return one point per filled grid cell. */
export function samplePoints(
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

function blobs(
  c: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  specs: number[][],
): void {
  c.beginPath();
  for (const [dx, dy, br] of specs) {
    c.moveTo(cx + dx * r + br * r, cy + dy * r);
    c.arc(cx + dx * r, cy + dy * r, br * r, 0, Math.PI * 2);
  }
  c.fill();
}

export function drawTreeCanopy(c: CanvasRenderingContext2D, w: number, h: number): void {
  blobs(c, w * 0.5, h * 0.32, Math.min(w, h) * 0.3, [
    [0, 0, 1],
    [-0.6, 0.18, 0.62],
    [0.6, 0.14, 0.64],
    [-0.32, -0.4, 0.56],
    [0.34, -0.36, 0.56],
    [0, 0.4, 0.6],
  ]);
}

export function drawTreeTrunk(c: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w * 0.5;
  c.beginPath();
  c.moveTo(cx - w * 0.06, h * 0.98);
  c.lineTo(cx - w * 0.022, h * 0.4);
  c.lineTo(cx + w * 0.022, h * 0.4);
  c.lineTo(cx + w * 0.06, h * 0.98);
  c.closePath();
  c.fill();
}

export function drawBonsaiCanopy(c: CanvasRenderingContext2D, w: number, h: number): void {
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

export function drawBonsaiTrunkPot(c: CanvasRenderingContext2D, w: number, h: number): void {
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

export function subsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const out: T[] = [];
  const stride = arr.length / max;
  for (let i = 0; i < max; i++) out.push(arr[Math.floor(i * stride)]);
  return out;
}

export function centroid(pts: Pt[]): { x: number; y: number } {
  if (!pts.length) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const p of pts) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / pts.length, y: sy / pts.length };
}

/** Sort points inner-first relative to a centre (closest squared-distance first). */
export function sortByDistance(pts: Pt[], c: { x: number; y: number }): Pt[] {
  return pts
    .slice()
    .sort(
      (a, b) => (a.x - c.x) ** 2 + (a.y - c.y) ** 2 - ((b.x - c.x) ** 2 + (b.y - c.y) ** 2),
    );
}

/** Read the themed bonsai palette off a mounted element's computed style. */
export function readBonsaiColors(el: Element, fallback: BonsaiColors): BonsaiColors {
  const cs = getComputedStyle(el);
  const v = (name: string, f: string) => cs.getPropertyValue(name).trim() || f;
  return {
    leaf: v('--bonsai-leaf', fallback.leaf),
    leafSoft: v('--bonsai-leaf-soft', fallback.leafSoft),
    bark: v('--bonsai-bark', fallback.bark),
  };
}
