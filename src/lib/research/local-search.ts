// Dependency-free local cache search: query parsing, AND semantics, token-aware matching,
// BM25-lite body ranking, and metadata field boosts. Designed for corpora up to ~5000 notes.

import { levenshtein, maxFuzzyDistance } from '../text.js';
import { STOPWORDS, tokenize } from './keywords.js';
import type { ArtifactType, CaptureMethod, ResearchArtifact, TokenEstimate } from './schema.js';

export type MatchField = 'topic' | 'tag' | 'source_url' | 'summary' | 'compressed';
export type MatchKind = 'exact' | 'prefix' | 'fuzzy' | 'phrase';
export type MetadataField = 'topic' | 'tag' | 'source_url';

export interface TermMatch {
  term: string;
  field: MatchField;
  kind: MatchKind;
}

export interface ParsedSearchQuery {
  /** Individual terms; every term must match somewhere (AND). */
  terms: string[];
  /** Quoted phrases; each must appear as a contiguous token sequence. */
  phrases: string[];
  /** Terms used for snippet highlighting (includes phrase tokens). */
  highlightTerms: string[];
}

export interface SearchCorpusStats {
  docCount: number;
  avgTokenLength: number;
  /** Document frequency per token across summary + compressed bodies. */
  df: Map<string, number>;
}

export interface PreparedSearchArtifact {
  artifact: ResearchArtifact;
  summaryTokens: readonly string[];
  compressedTokens: readonly string[];
}

export interface LocalSearchScore {
  score: number;
  matchedTerms: TermMatch[];
  snippet: string;
}

/** JSON result shape returned by the search command for local cache hits. */
export interface LocalSearchResult {
  cacheKey: string;
  path: string;
  artifactType: ArtifactType;
  sourceUrls: string[];
  topic: string | null;
  tags: string[];
  freshness: string;
  captureMethod: CaptureMethod | null;
  tokenEstimate: TokenEstimate;
  snippet: string;
  matchedTerms: TermMatch[];
  siteModuleId: string | null;
  score: number;
}

const SEARCH_FIELD_ORDER: readonly MatchField[] = [
  'topic',
  'tag',
  'source_url',
  'summary',
  'compressed',
];

const BM25_K1 = 1.5;
const BM25_B = 0.75;
const SECTION_BONUS = 15;

const METADATA_WEIGHT: Record<MetadataField, Record<'exact' | 'prefix' | 'fuzzy', number>> = {
  topic: { exact: 100, prefix: 70, fuzzy: 45 },
  tag: { exact: 80, prefix: 55, fuzzy: 35 },
  source_url: { exact: 50, prefix: 35, fuzzy: 25 },
};

const PHRASE_FIELD_BONUS: Record<MatchField, number> = {
  topic: 200,
  tag: 150,
  source_url: 60,
  summary: 80,
  compressed: 40,
};

const ADJACENT_PHRASE_BONUS: Partial<Record<MatchField, number>> = {
  topic: 120,
  tag: 90,
  summary: 50,
  compressed: 25,
};

const FRESHNESS_BONUS: Record<string, number> = { fresh: 30, stale_grace: 10 };

const FIELD_RANK: Record<MatchField, number> = {
  topic: 5,
  tag: 4,
  source_url: 3,
  summary: 2,
  compressed: 1,
};

const KIND_RANK: Record<MatchKind, number> = {
  exact: 4,
  phrase: 3,
  prefix: 2,
  fuzzy: 1,
};

interface SearchFieldSlice {
  field: MatchField;
  text: string;
}

/**
 * Parses a search query into AND terms and mandatory quoted phrases. Strips English stopwords from
 * unquoted tokens; phrase content is kept verbatim (lowercased).
 */
export function parseSearchQuery(raw: string): ParsedSearchQuery {
  const phrases: string[] = [];
  const stripped = raw.replace(/"([^"]+)"/g, (_match, phrase: string) => {
    const normalized = phrase.trim().toLowerCase();
    if (normalized) phrases.push(normalized);
    return ' ';
  });

  const terms: string[] = [];
  for (const part of stripped.toLowerCase().split(/\s+/).filter(Boolean)) {
    if (STOPWORDS.has(part)) continue;
    terms.push(part);
  }

  const highlightTerms = [
    ...new Set([...terms, ...phrases.flatMap((phrase) => tokenize(phrase))]),
  ].filter((t) => t.length >= 2);

  return { terms, phrases, highlightTerms };
}

/** True when the query has no searchable terms or phrases after normalization. */
export function isEmptySearchQuery(query: ParsedSearchQuery): boolean {
  return query.terms.length === 0 && query.phrases.length === 0;
}

/** Tokenizes artifact bodies once per search candidate. */
export function prepareSearchArtifact(artifact: ResearchArtifact): PreparedSearchArtifact {
  return {
    artifact,
    summaryTokens: tokenize(artifact.summary),
    compressedTokens: tokenize(artifact.compressed),
  };
}

/**
 * Builds corpus statistics for BM25 IDF from prepared artifact bodies. IDF is computed over the
 * provided candidate pool (typically all active entries that pass metadata filters).
 */
export function buildSearchCorpusStats(prepared: PreparedSearchArtifact[]): SearchCorpusStats {
  const df = new Map<string, number>();
  let totalTokens = 0;

  for (const { summaryTokens, compressedTokens } of prepared) {
    const tokens = [...summaryTokens, ...compressedTokens];
    totalTokens += tokens.length;
    const unique = new Set(tokens);
    for (const token of unique) {
      df.set(token, (df.get(token) ?? 0) + 1);
    }
  }

  const docCount = prepared.length;
  return {
    docCount,
    avgTokenLength: docCount > 0 ? totalTokens / docCount : 1,
    df,
  };
}

/** Maps a scored artifact to the search command JSON result shape. */
export function toLocalSearchResult(
  filePath: string,
  prepared: PreparedSearchArtifact,
  freshness: string,
  scored: LocalSearchScore
): LocalSearchResult {
  const { metadata } = prepared.artifact;
  return {
    cacheKey: metadata.cache_key,
    path: filePath,
    artifactType: metadata.artifact_type,
    sourceUrls: metadata.source_urls,
    topic: metadata.topic,
    tags: metadata.tags,
    freshness,
    captureMethod: metadata.capture_method,
    tokenEstimate: metadata.token_estimate,
    snippet: scored.snippet,
    matchedTerms: scored.matchedTerms,
    siteModuleId: metadata.site_module_id,
    score: scored.score,
  };
}

function* searchFieldSlices(artifact: ResearchArtifact): Generator<SearchFieldSlice> {
  const meta = artifact.metadata;
  if (meta.topic) yield { field: 'topic', text: meta.topic };
  for (const tag of meta.tags ?? []) {
    if (tag) yield { field: 'tag', text: tag };
  }
  const urls = [meta.source_url, ...(meta.source_urls ?? [])].filter(Boolean).join(' ');
  if (urls) yield { field: 'source_url', text: urls };
  if (artifact.summary) yield { field: 'summary', text: artifact.summary };
  if (artifact.compressed) yield { field: 'compressed', text: artifact.compressed };
}

function compareMatches(a: TermMatch, b: TermMatch | null): number {
  if (!b) return 1;
  const fieldDiff = FIELD_RANK[a.field] - FIELD_RANK[b.field];
  if (fieldDiff !== 0) return fieldDiff;
  return KIND_RANK[a.kind] - KIND_RANK[b.kind];
}

function idf(term: string, corpus: SearchCorpusStats): number {
  const df = corpus.df.get(term) ?? 0;
  const n = Math.max(corpus.docCount, 1);
  return Math.log((n - df + 0.5) / (df + 0.5) + 1);
}

function bm25TermScore(
  term: string,
  tf: number,
  docLen: number,
  corpus: SearchCorpusStats
): number {
  if (tf <= 0) return 0;
  const idfScore = idf(term, corpus);
  const avgLen = Math.max(corpus.avgTokenLength, 1);
  const tfNorm = (tf * (BM25_K1 + 1)) / (tf + BM25_K1 * (1 - BM25_B + BM25_B * (docLen / avgLen)));
  return idfScore * tfNorm;
}

function matchTermAgainstToken(term: string, token: string): MatchKind | null {
  if (term.length < 2) return null;
  if (token === term) return 'exact';
  if (term.length >= 3 && token.startsWith(term) && token.length > term.length) return 'prefix';
  if (term.length >= 4 && token.length >= 4) {
    if (levenshtein(term, token) <= maxFuzzyDistance(term)) return 'fuzzy';
  }
  return null;
}

function matchTermInTokens(term: string, tokens: readonly string[]): MatchKind | null {
  let best: MatchKind | null = null;
  for (const token of tokens) {
    const kind = matchTermAgainstToken(term, token);
    if (!kind) continue;
    if (!best || KIND_RANK[kind] > KIND_RANK[best]) best = kind;
    if (best === 'exact') return best;
  }
  return best;
}

function matchTermInTag(term: string, tag: string): MatchKind | null {
  const lower = tag.toLowerCase();
  const whole = matchTermAgainstToken(term, lower);
  if (whole) return whole;
  return matchTermInTokens(term, tokenize(lower));
}

function matchTermInField(term: string, slice: SearchFieldSlice): MatchKind | null {
  return slice.field === 'tag'
    ? matchTermInTag(term, slice.text)
    : matchTermInTokens(term, tokenize(slice.text));
}

/** True when phrase tokens appear consecutively in text (not as substrings inside other tokens). */
export function phraseInTokenSequence(phrase: string, text: string): boolean {
  const phraseTokens = tokenize(phrase);
  if (phraseTokens.length === 0) return false;
  const fieldTokens = tokenize(text);
  if (fieldTokens.length < phraseTokens.length) return false;
  outer: for (let i = 0; i <= fieldTokens.length - phraseTokens.length; i++) {
    for (let j = 0; j < phraseTokens.length; j++) {
      if (fieldTokens[i + j] !== phraseTokens[j]) continue outer;
    }
    return true;
  }
  return false;
}

function countMatchingTokens(tokens: readonly string[], term: string): number {
  let count = 0;
  for (const token of tokens) {
    if (matchTermAgainstToken(term, token)) count++;
  }
  return count;
}

function findTermMatch(term: string, artifact: ResearchArtifact): TermMatch | null {
  let best: TermMatch | null = null;
  for (const slice of searchFieldSlices(artifact)) {
    const kind = matchTermInField(term, slice);
    if (!kind) continue;
    const candidate: TermMatch = { term, field: slice.field, kind };
    if (compareMatches(candidate, best) > 0) best = candidate;
  }
  return best;
}

function findPhraseMatch(phrase: string, artifact: ResearchArtifact): TermMatch | null {
  let best: TermMatch | null = null;
  for (const slice of searchFieldSlices(artifact)) {
    if (!phraseInTokenSequence(phrase, slice.text)) continue;
    const candidate: TermMatch = { term: phrase, field: slice.field, kind: 'phrase' };
    if (compareMatches(candidate, best) > 0) best = candidate;
  }
  return best;
}

function metadataBoost(match: TermMatch): number {
  if (match.kind === 'phrase') return PHRASE_FIELD_BONUS[match.field];
  if (match.field === 'summary' || match.field === 'compressed') return 0;
  const weights = METADATA_WEIGHT[match.field];
  return weights[match.kind];
}

function adjacentPhraseBonus(terms: string[], artifact: ResearchArtifact): number {
  if (terms.length <= 1) return 0;
  const phrase = terms.join(' ');
  let bonus = 0;
  for (const slice of searchFieldSlices(artifact)) {
    if (!phraseInTokenSequence(phrase, slice.text)) continue;
    bonus = Math.max(bonus, ADJACENT_PHRASE_BONUS[slice.field] ?? 0);
  }
  return bonus;
}

function snippetTexts(artifact: ResearchArtifact): string[] {
  const meta = artifact.metadata;
  return [
    artifact.summary.trim(),
    artifact.compressed.trim(),
    meta.topic?.trim() ?? '',
    (meta.tags ?? []).join(' ').trim(),
  ].filter(Boolean);
}

function snippetNeedles(query: ParsedSearchQuery): string[] {
  return [...query.phrases, ...query.terms].filter((n) => n.length >= 2);
}

function needleCoverageInWindow(window: string, needles: readonly string[]): number {
  let count = 0;
  for (const needle of needles) {
    if (window.includes(needle)) count++;
  }
  return count;
}

interface SnippetAnchor {
  text: string;
  idx: number;
  coverage: number;
}

function findSnippetAnchor(
  candidates: readonly string[],
  needles: readonly string[]
): SnippetAnchor {
  const primary = candidates[0] ?? '';
  let best: SnippetAnchor = { text: primary, idx: 0, coverage: -1 };

  for (const text of candidates) {
    const lower = text.toLowerCase();
    for (const needle of needles) {
      let idx = 0;
      while ((idx = lower.indexOf(needle, idx)) !== -1) {
        const start = Math.max(0, idx - 50);
        const coverage = needleCoverageInWindow(lower.slice(start, start + 160), needles);
        if (coverage > best.coverage) best = { text, idx, coverage };
        idx += 1;
      }
    }
  }

  if (best.coverage >= 0) return best;

  const lower = best.text.toLowerCase();
  for (const needle of needles) {
    const idx = lower.indexOf(needle);
    if (idx !== -1) return { text: best.text, idx, coverage: 0 };
  }
  return best;
}

function formatSnippetExcerpt(text: string, anchorIdx: number): string {
  const start = Math.max(0, anchorIdx - 50);
  const end = Math.min(text.length, anchorIdx + 110);
  let snippet = text.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  return snippet;
}

/**
 * Builds a snippet around the query terms/phrases, preferring summary text and maximizing term
 * coverage in the visible window. Falls back to topic/tags when body text is empty or generic.
 */
export function makeSearchSnippet(artifact: ResearchArtifact, query: ParsedSearchQuery): string {
  const candidates = snippetTexts(artifact);
  const primary = candidates[0] ?? '';
  if (!primary) return '';

  const needles = snippetNeedles(query);
  if (needles.length === 0) return primary.slice(0, 150).replace(/\s+/g, ' ').trim();

  const anchor = findSnippetAnchor(candidates, needles);
  return formatSnippetExcerpt(anchor.text, anchor.idx);
}

/**
 * Scores one artifact against a parsed query. Returns null when AND/phrase requirements are not
 * met. All ranking modifiers (freshness, section boost) are applied here.
 */
export function scoreLocalSearch(
  prepared: PreparedSearchArtifact,
  query: ParsedSearchQuery,
  corpus: SearchCorpusStats,
  freshness: string
): LocalSearchScore | null {
  const { artifact, summaryTokens, compressedTokens } = prepared;
  const matchedTerms: TermMatch[] = [];

  for (const term of query.terms) {
    const match = findTermMatch(term, artifact);
    if (!match) return null;
    matchedTerms.push(match);
  }

  for (const phrase of query.phrases) {
    const match = findPhraseMatch(phrase, artifact);
    if (!match) return null;
    matchedTerms.push(match);
  }

  let score = 0;
  for (const match of matchedTerms) {
    score += metadataBoost(match);
  }

  const summaryLen = summaryTokens.length;
  const compressedLen = compressedTokens.length;
  for (const term of query.terms) {
    score += bm25TermScore(term, countMatchingTokens(summaryTokens, term), summaryLen, corpus) * 3;
    score += bm25TermScore(
      term,
      countMatchingTokens(compressedTokens, term),
      compressedLen,
      corpus
    );
  }

  score += adjacentPhraseBonus(query.terms, artifact);
  score += FRESHNESS_BONUS[freshness] ?? 0;
  if (artifact.metadata.artifact_type === 'section') score += SECTION_BONUS;

  return {
    score: Math.round(score * 100) / 100,
    matchedTerms,
    snippet: makeSearchSnippet(artifact, query),
  };
}

/** Field priority order used for match ranking (highest first). */
export function searchFieldOrder(): readonly MatchField[] {
  return SEARCH_FIELD_ORDER;
}
