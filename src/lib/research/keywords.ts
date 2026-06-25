// Dependency-free keyword extraction used to auto-tag imported/fetched research when the caller
// supplies no tags. This is a deliberately simple term-frequency heuristic.
// ponytail: TF + stopwords + heading boost. Ceiling: no phrase/entity detection, English-only
// stopwords. Upgrade path: swap in RAKE/YAKE or an LLM pass behind the same extractKeywords() API.

import type { ResearchArtifact } from './schema.js';

const AUTO_TAG_NOTE = 'auto-generated tags via keyword extraction';

// Common English function words plus a few markdown/doc-noise words. Kept inline (no dependency)
// because the list is small and stable.
export const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'if',
  'then',
  'else',
  'when',
  'while',
  'for',
  'of',
  'to',
  'in',
  'on',
  'at',
  'by',
  'with',
  'from',
  'into',
  'onto',
  'as',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'am',
  'do',
  'does',
  'did',
  'doing',
  'have',
  'has',
  'had',
  'having',
  'this',
  'that',
  'these',
  'those',
  'it',
  'its',
  'they',
  'them',
  'their',
  'there',
  'here',
  'we',
  'you',
  'your',
  'our',
  'us',
  'i',
  'me',
  'my',
  'he',
  'she',
  'his',
  'her',
  'not',
  'no',
  'nor',
  'so',
  'than',
  'too',
  'very',
  'can',
  'will',
  'just',
  'should',
  'would',
  'could',
  'may',
  'might',
  'must',
  'shall',
  'about',
  'above',
  'after',
  'again',
  'against',
  'all',
  'any',
  'because',
  'before',
  'below',
  'between',
  'both',
  'down',
  'during',
  'each',
  'few',
  'further',
  'how',
  'more',
  'most',
  'other',
  'over',
  'own',
  'same',
  'some',
  'such',
  'only',
  'out',
  'up',
  'off',
  'where',
  'which',
  'who',
  'whom',
  'why',
  'what',
  'whose',
  'also',
  'use',
  'used',
  'using',
  'via',
  'per',
  'e.g',
  'i.e',
  'etc',
  'get',
  'set',
  'see',
  'note',
  'example',
  'one',
  'two',
  'three',
  'new',
  'like',
  'within',
  'without',
]);

// Splits text into candidate tokens, keeping tech-flavoured shapes intact (e.g. "node.js", "c#",
// "asp.net") while trimming leading/trailing separators left over from sentence punctuation.
export function tokenize(text: string): string[] {
  const raw = text.toLowerCase().match(/[a-z0-9][a-z0-9+#.-]*/g) ?? [];
  return raw.map((w) => w.replace(/^[.\-]+|[.\-]+$/g, '')).filter(Boolean);
}

function cleanNoise(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ');
}

function getHeadingTerms(cleaned: string): Set<string> {
  const headingTerms = new Set<string>();
  for (const line of cleaned.split('\n')) {
    if (/^\s{0,3}#{1,6}\s/.test(line)) {
      for (const term of tokenize(line)) {
        headingTerms.add(term);
      }
    }
  }
  return headingTerms;
}

function calculateFrequencies(cleaned: string, headingTerms: Set<string>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokenize(cleaned)) {
    if (token.length < 3 || STOPWORDS.has(token) || /^\d+$/.test(token)) {
      continue;
    }
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  for (const term of headingTerms) {
    const val = counts.get(term);
    if (val !== undefined) {
      counts.set(term, val + 3);
    }
  }
  return counts;
}

/**
 * Derives up to `max` keyword tags from free-form Markdown/text by term frequency.
 * Code blocks, inline code, and URLs are stripped first; stopwords, pure numbers, and very short
 * tokens are dropped; terms appearing in Markdown headings get a frequency boost. Ranking is
 * deterministic (frequency desc, then alphabetical) so the same input always yields the same tags.
 */
export function extractKeywords(text: string, max = 5): string[] {
  if (!text || !text.trim() || max <= 0) return [];

  const cleaned = cleanNoise(text);
  const headingTerms = getHeadingTerms(cleaned);
  const counts = calculateFrequencies(cleaned, headingTerms);
  if (counts.size === 0) return [];

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([term]) => term);
}

/**
 * Back-fills keyword tags for an artifact that has none, deriving them from its detailed content and
 * recording a quality note. No-op when tags are already present, so user- or caller-supplied tags
 * always win. Mutates and returns the same artifact. This is the single entry point every ingestion
 * path (import, fetch, revalidation) uses, so the auto-tag policy lives in exactly one place.
 */
export function applyAutoTags(artifact: ResearchArtifact): ResearchArtifact {
  if (artifact.metadata.tags.length > 0) return artifact;
  const tags = extractKeywords(artifact.detailed);
  if (tags.length === 0) return artifact;
  artifact.metadata.tags = tags;
  artifact.metadata.quality_notes = [...artifact.metadata.quality_notes, AUTO_TAG_NOTE];
  return artifact;
}
