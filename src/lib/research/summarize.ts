// Dependency-free extractive summarizer used as a fallback when structural compression
// (compressMarkdown) fails to meaningfully shrink prose-heavy pages. It selects the most important
// *original* sentences from prose paragraphs and drops the rest, while emitting headings, fenced
// code blocks, tables, and lists verbatim. Extractive only — it never rewrites text, so no LLM.
// ponytail: frequency scoring for small inputs, TextRank (token-overlap similarity + weighted
// PageRank) for mid-sized ones. Ceiling: English-only stopwords, regex sentence splitting, lexical
// (not semantic) similarity, O(n^2) TextRank capped by sentence count. Upgrade path: embedding-based
// similarity or an abstractive LLM pass behind the same summarizeMarkdown() API.

import type { SummaryLevel } from '../config/schema.js';
import { STOPWORDS, tokenize } from './keywords.js';
import { estimateTokens } from './token-estimate.js';

export type { SummaryLevel };

export interface SummarizeOptions {
  /** Aggressiveness of prose reduction. Default 'conservative'. */
  level?: SummaryLevel;
  /** Below this token count the whole document is returned unchanged. Default 200. */
  minTokens?: number;
  /** Prose paragraphs with fewer sentences than this are kept whole. Default 2. */
  minSentences?: number;
}

// Target output prose length as a fraction of input prose length, per level.
const TARGET_RATIO: Record<SummaryLevel, number> = {
  conservative: 0.65,
  balanced: 0.5,
  aggressive: 0.35,
};

const DEFAULT_MIN_TOKENS = 200;
const DEFAULT_MIN_SENTENCES = 2;
// Below this, PageRank over a tiny graph is degenerate; above it the O(n^2) matrix gets expensive.
// Outside the window we fall back to linear frequency scoring.
const TEXTRANK_MIN_SENTENCES = 10;
const TEXTRANK_MAX_SENTENCES = 500;

// Abbreviations whose trailing period must not end a sentence. Lowercased, internal dots kept.
const ABBREVIATIONS = new Set([
  'e.g',
  'i.e',
  'etc',
  'vs',
  'mr',
  'mrs',
  'dr',
  'prof',
  'fig',
  'no',
  'al',
  'inc',
  'ltd',
  'co',
  'vol',
  'pp',
  'eq',
  'ref',
  'cf',
  'approx',
  'est',
  'dept',
  'st',
  'jr',
  'sr',
]);

interface Segment {
  kind: 'verbatim' | 'prose';
  lines: string[];
}

interface Sentence {
  segIdx: number;
  globalIdx: number;
  text: string;
  chars: number;
  isFirst: boolean;
  score: number;
}

const isHeading = (line: string): boolean => /^\s{0,3}#{1,6}\s/.test(line);

// Lines that must survive verbatim: structural markdown that a sentence splitter would mangle.
function isVerbatim(line: string): boolean {
  return (
    line.trim() === '' ||
    isHeading(line) ||
    /^\s*([-*+]|\d+\.)\s/.test(line) || // list item
    /^\s*>/.test(line) || // blockquote
    /^\s*([-*_])(\s*\1){2,}\s*$/.test(line) || // thematic break
    /^\s*<!--/.test(line) || // single-line HTML comment (multi-line tracked in segment)
    /^\s*<\/?[a-zA-Z]/.test(line) || // HTML block
    line.includes('|') || // table row (contiguous runs preserved)
    /^\s{2,}\S/.test(line) // indented: list continuation or indented code
  );
}

// Single forward pass grouping contiguous same-kind lines. Fenced code and multi-line HTML comments
// are fully preserved; an unclosed fence/comment keeps everything to EOF verbatim (fail safe toward
// keeping content). Tracking comments as a block keeps their inner lines (e.g. Node's `<!-- YAML
// ... -->` changelog metadata) out of prose scoring and stops them being reflowed.
class BlockState {
  fenceMarker = '';
  inComment = false;

  update(line: string): boolean {
    if (this.inComment) {
      if (line.includes('-->')) this.inComment = false;
      return true;
    }
    const fenceMatch = /^\s*(```+|~~~+)/.exec(line);
    if (this.fenceMarker) {
      if (fenceMatch && line.trim().startsWith(this.fenceMarker)) this.fenceMarker = '';
      return true;
    }
    if (fenceMatch) {
      this.fenceMarker = fenceMatch[1]!;
      return true;
    }
    if (line.trimStart().startsWith('<!--') && !line.includes('-->')) {
      this.inComment = true;
      return true;
    }
    return false;
  }
}

// Single forward pass grouping contiguous same-kind lines. Fenced code and multi-line HTML comments
// are fully preserved; an unclosed fence/comment keeps everything to EOF verbatim (fail safe toward
// keeping content). Tracking comments as a block keeps their inner lines (e.g. Node's `<!-- YAML
// ... -->` changelog metadata) out of prose scoring and stops them being reflowed.
function segment(markdown: string): Segment[] {
  const segments: Segment[] = [];
  let current: Segment | null = null;
  const state = new BlockState();

  const push = (kind: Segment['kind'], line: string): void => {
    if (current && current.kind === kind) current.lines.push(line);
    else {
      current = { kind, lines: [line] };
      segments.push(current);
    }
  };

  for (const line of markdown.split('\n')) {
    const isSpecialBlock = state.update(line);
    const kind = isSpecialBlock || isVerbatim(line) ? 'verbatim' : 'prose';
    push(kind, line);
  }
  return segments;
}

// Replaces inline-code spans with NUL-delimited index placeholders so a '.' inside `code` cannot
// trigger a false sentence boundary; the returned restore() puts the originals back. Any NUL in the
// (untrusted) input is stripped first so the placeholder is collision-proof — otherwise a stray
// "NUL digit NUL" run already in the source would be mistaken for a placeholder and silently dropped.
function maskInlineCode(text: string): { masked: string; restore: (s: string) => string } {
  const spans: string[] = [];
  const masked = text.replace(/\u0000/g, '').replace(/`[^`]*`/g, (m) => {
    const token = `\u0000${spans.length}\u0000`;
    spans.push(m);
    return token;
  });
  const restore = (s: string): string =>
    s.replace(/\u0000(\d+)\u0000/g, (_, n) => spans[Number(n)] ?? '');
  return { masked, restore };
}

function lastWhitespaceIndex(s: string, from: number): number {
  for (let k = from - 1; k >= 0; k--) {
    if (/\s/.test(s[k]!)) return k;
  }
  return -1;
}

// Splits a single prose paragraph into sentences, avoiding splits inside inline code, after known
// abbreviations or single-letter initials, and before digits. Exported for unit testing because
// sentence boundaries are not observable once kept sentences are rejoined.
function findBoundaryEnd(masked: string, startIdx: number): number {
  let end = startIdx;
  while (end + 1 < masked.length && '.!?'.includes(masked[end + 1]!)) {
    end++;
  }
  return end;
}

function hasSentenceStartLookahead(masked: string, fromIndex: number): boolean {
  return /^(\s+)["'(\[]?[A-Z0-9]/.test(masked.slice(fromIndex));
}

function isAbbreviationOrInitial(masked: string, periodIndex: number): boolean {
  const wordStart = lastWhitespaceIndex(masked, periodIndex) + 1;
  const word = masked.slice(wordStart, periodIndex).toLowerCase().replace(/\.+$/, '');
  return ABBREVIATIONS.has(word) || word.length === 1;
}

function shouldSkipBoundary(masked: string, i: number, end: number): boolean {
  if (!hasSentenceStartLookahead(masked, end + 1)) {
    return true;
  }
  if (masked[i] === '.' && isAbbreviationOrInitial(masked, i)) {
    return true;
  }
  return false;
}

// Splits a single prose paragraph into sentences, avoiding splits inside inline code, after known
// abbreviations or single-letter initials, and before digits. Exported for unit testing because
// sentence boundaries are not observable once kept sentences are rejoined.
export function splitSentences(paragraph: string): string[] {
  const { masked, restore } = maskInlineCode(paragraph);
  const sentences: string[] = [];
  let start = 0;

  for (let i = 0; i < masked.length; i++) {
    if (!'.!?'.includes(masked[i]!)) continue;

    const end = findBoundaryEnd(masked, i);

    if (shouldSkipBoundary(masked, i, end)) {
      i = end;
      continue;
    }

    const sentence = masked.slice(start, end + 1).trim();
    if (sentence) {
      sentences.push(restore(sentence));
    }
    start = end + 1;
    i = end;
  }

  const tail = masked.slice(start).trim();
  if (tail) {
    sentences.push(restore(tail));
  }
  return sentences;
}

// Content-bearing tokens for scoring: code/URLs stripped, stopwords/short/numeric tokens dropped.
// Same filter as keywords.ts so scoring stays consistent with auto-tagging.
function contentTokens(text: string): string[] {
  const stripped = text.replace(/`[^`]*`/g, ' ').replace(/https?:\/\/\S+/g, ' ');
  return tokenize(stripped).filter((t) => t.length >= 3 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

function buildFrequencies(text: string, headingTerms: Set<string>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of contentTokens(text)) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  // Terms echoed in headings are likely topical; weight them above body mentions.
  for (const term of headingTerms) {
    if (counts.has(term)) counts.set(term, counts.get(term)! + 3);
  }
  return counts;
}

function frequencyScore(text: string, freq: Map<string, number>): number {
  const tokens = contentTokens(text);
  if (tokens.length === 0) return 0;
  let sum = 0;
  for (const t of tokens) sum += freq.get(t) ?? 0;
  return sum / tokens.length; // length-normalized → no long-sentence bias
}

function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let common = 0;
  for (const t of a) if (b.has(t)) common++;
  if (common === 0) return 0;
  // Mihalcea TextRank normalization: overlap divided by the log sizes of both sentences.
  return common / (Math.log(a.size + 1) + Math.log(b.size + 1));
}

// Weighted PageRank over the sentence-similarity graph. Fixed iterations + uniform init keep it
// deterministic. Returns one centrality score per sentence, index-aligned with `sets`.
function textRankScores(sets: Set<string>[]): number[] {
  const n = sets.length;
  const weights: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const rowSums = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const w = similarity(sets[i]!, sets[j]!);
      weights[i]![j] = w;
      weights[j]![i] = w;
      rowSums[i] += w;
      rowSums[j] += w;
    }
  }

  const damping = 0.85;
  let scores = new Array<number>(n).fill(1 / n);
  for (let iter = 0; iter < 30; iter++) {
    const next = new Array<number>(n).fill((1 - damping) / n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const wji = weights[j]![i]!;
        const rsj = rowSums[j]!;
        if (i === j || wji === 0 || rsj === 0) continue;
        next[i]! += damping * (wji / rsj) * scores[j]!;
      }
    }
    scores = next;
  }
  return scores;
}

// Lexical scoring ranks a "data corruption may occur" warning no higher than a bland description,
// so plain extraction can drop the sentences a reader can least afford to lose. Two tiers counter
// that, both kept tight enough not to fire on ordinary prose:
//  - CRITICAL: catastrophic-if-lost cues (data loss, security, hard prohibitions, deprecation).
//    These are force-kept in selection, never dropped — the same guarantee as a paragraph anchor.
//  - CAUTION: broader API caveats (constraints, failure modes). These only get a score boost, so
//    they are preferred when budget allows but can still yield on heavily anchor-saturated pages.
const CRITICAL =
  /\b(must not|mustn't|cannot|can't|do not|don't|should not|shouldn't|never|deprecat\w*|unsafe|security|secret|corrupt\w*|data loss|overwrit\w*|irreversible|not permitted|warning|caution|danger\w*)\b/i;
const CAUTION =
  /\b(must|required?|requires?|throws?|fails?|failure|invalid|important|only if|note that|otherwise)\b/i;
const SALIENCE_BOOST = 1.6;

// Raises the score of broad-caveat sentences so the budget cut preserves them preferentially.
// Multiplicative so it composes with either scorer's scale (frequency sum or PageRank centrality).
function applySalienceBoost(sentences: Sentence[]): void {
  for (const s of sentences) if (CAUTION.test(s.text)) s.score *= SALIENCE_BOOST;
}

function scoreSentences(sentences: Sentence[], headingTerms: Set<string>): void {
  const n = sentences.length;
  if (n >= TEXTRANK_MIN_SENTENCES && n <= TEXTRANK_MAX_SENTENCES) {
    const scores = textRankScores(sentences.map((s) => new Set(contentTokens(s.text))));
    sentences.forEach((s, i) => (s.score = scores[i]!));
  } else {
    const freq = buildFrequencies(sentences.map((s) => s.text).join(' '), headingTerms);
    for (const s of sentences) s.score = frequencyScore(s.text, freq);
  }
  applySalienceBoost(sentences);
}

function collectHeadingTerms(segments: Segment[]): Set<string> {
  const terms = new Set<string>();
  for (const seg of segments) {
    if (seg.kind !== 'verbatim') continue;
    for (const line of seg.lines) {
      if (isHeading(line)) for (const t of tokenize(line)) terms.add(t);
    }
  }
  return terms;
}

function collectSentences(segments: Segment[]): Sentence[] {
  const sentences: Sentence[] = [];
  let globalIdx = 0;
  segments.forEach((seg, segIdx) => {
    if (seg.kind !== 'prose') return;
    const paragraph = seg.lines.join(' ').replace(/\s+/g, ' ').trim();
    splitSentences(paragraph).forEach((text, idxInSeg) => {
      sentences.push({
        segIdx,
        globalIdx: globalIdx++,
        text,
        chars: text.length,
        isFirst: idxInSeg === 0,
        score: 0,
      });
    });
  });
  return sentences;
}

// Picks which sentences to keep: every paragraph's first sentence (and every sentence of a
// short paragraph) is anchored; the remaining budget is filled by score, highest first.
function selectKept(sentences: Sentence[], level: SummaryLevel, minSentences: number): Set<number> {
  const perSeg = new Map<number, number>();
  for (const s of sentences) perSeg.set(s.segIdx, (perSeg.get(s.segIdx) ?? 0) + 1);

  const kept = new Set<number>();
  let keptChars = 0;
  const keep = (s: Sentence): void => {
    if (kept.has(s.globalIdx)) return;
    kept.add(s.globalIdx);
    keptChars += s.chars;
  };

  for (const s of sentences) {
    // Anchor every paragraph's first sentence and every sentence of a short paragraph, and never
    // drop a critical caveat regardless of level — these are kept before any budget is spent.
    if (s.isFirst || perSeg.get(s.segIdx)! < minSentences || CRITICAL.test(s.text)) keep(s);
  }

  const totalChars = sentences.reduce((sum, s) => sum + s.chars, 0);
  const target = totalChars * TARGET_RATIO[level];
  const candidates = sentences
    .filter((s) => !kept.has(s.globalIdx))
    .sort((a, b) => b.score - a.score || a.globalIdx - b.globalIdx);
  for (const s of candidates) {
    if (keptChars >= target) break;
    keep(s);
  }
  return kept;
}

function reassemble(segments: Segment[], sentences: Sentence[], kept: Set<number>): string {
  const bySeg = new Map<number, Sentence[]>();
  for (const s of sentences) {
    if (!bySeg.has(s.segIdx)) bySeg.set(s.segIdx, []);
    bySeg.get(s.segIdx)!.push(s);
  }
  const out = segments.map((seg, segIdx) => {
    if (seg.kind === 'verbatim') return seg.lines.join('\n');
    return (bySeg.get(segIdx) ?? [])
      .filter((s) => kept.has(s.globalIdx))
      .map((s) => s.text)
      .join(' ');
  });
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extractively shortens the prose paragraphs of a Markdown document while preserving headings,
 * fenced code blocks, tables, and lists verbatim. Returns the input unchanged when it is below
 * `minTokens` or contains no prose to condense. Deterministic for identical input + options.
 */
export function summarizeMarkdown(markdown: string, options: SummarizeOptions = {}): string {
  const level = options.level ?? 'conservative';
  const minTokens = options.minTokens ?? DEFAULT_MIN_TOKENS;
  const minSentences = options.minSentences ?? DEFAULT_MIN_SENTENCES;

  if (!markdown || !markdown.trim()) return markdown;
  if (estimateTokens(markdown) < minTokens) return markdown;

  const segments = segment(markdown);
  const sentences = collectSentences(segments);
  if (sentences.length === 0) return markdown;

  scoreSentences(sentences, collectHeadingTerms(segments));
  const kept = selectKept(sentences, level, minSentences);
  return reassemble(segments, sentences, kept);
}
