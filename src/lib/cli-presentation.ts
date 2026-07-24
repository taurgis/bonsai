import { colors } from './color.js';
import { MAX_TAG_LENGTH, MAX_TOPIC_LENGTH } from './research/metadata-flags.js';
import { NO_TOPIC_LABEL, sanitizeForTerminal } from './text.js';

const HUMAN_LABEL_WIDTH = 25;

// Repeated verbatim across several flag descriptions; single-use wording lives inline below.
const DURATION_EXAMPLES = 'e.g. "2h", "7d", "6m"';
const SECRET_STORAGE_NOTE = 'secrets always stored globally';

/** Shared flag/help copy so identical flags read identically across commands. */
export const CLI_FLAG_DESCRIPTIONS = {
  freshnessTierPolicy: 'freshness tier policy',
  statusFreshnessTierPolicy:
    "freshness tier policy to evaluate; when omitted, uses the cached entry's own tier",
  fetchTtl: `TTL duration for freshness (${DURATION_EXAMPLES})`,
  importTtl: `TTL duration for imported note freshness (${DURATION_EXAMPLES})`,
  statusTtl: `TTL duration to evaluate freshness (${DURATION_EXAMPLES})`,
  maxAge: `maximum cache age to accept (${DURATION_EXAMPLES})`,
  fetchStorage: `override where this result is cached (${SECRET_STORAGE_NOTE})`,
  importStorage: `override where this note is cached (${SECRET_STORAGE_NOTE})`,
  fetchTopic: `main research topic for metadata (max ${MAX_TOPIC_LENGTH} chars)`,
  importTopic: `main topic for this research note (max ${MAX_TOPIC_LENGTH} chars)`,
  filterTopic: 'exact topic (case-insensitive)',
  fetchTags: `taxonomic tags for this research (can be repeated, max ${MAX_TAG_LENGTH} chars each)`,
  importTags: `taxonomic tags (can be repeated, max ${MAX_TAG_LENGTH} chars each)`,
  filterTags: 'tags to require (must match all)',
  format: 'output format',
  readOnly:
    '(alias: --plan) block filesystem writes/deletes; network fetches still run; also honored via BONSAI_READ_ONLY/BONSAI_PLAN_MODE',
  toon: 'emit the same envelope as --json, encoded as TOON (fewer tokens); cannot be combined with --json',
  sourceUrlGlob: 'source URL glob (case-insensitive, supports * wildcard)',
  listArtifactType:
    'artifact type; section children are omitted from list - use inspect to see them',
  pruneArtifactType: 'artifact type to prune, including section children',
  listFull:
    'include every metadata field (cache key, path, artifact type, tags, capture method, quality notes, timestamps); default output is a minimal row (source URLs, topic, freshness, token estimate)',
  searchQuery:
    'keyword(s) to search across topic, tags, summary, and compressed content (case-insensitive); every term must match somewhere unless --match-any is set',
  searchMatchAny: 'match any query term instead of requiring all of them (OR instead of AND)',
  searchArtifactType:
    'artifact type; section children are omitted from search - use inspect to see them',
  searchFull:
    'include every metadata field (cache key, path, artifact type, tags, capture method, quality notes, timestamps) alongside score/matchedFields/snippet; default output is a minimal row (source URLs, topic, freshness, token estimate, score, matchedFields, snippet)',
} as const;

/** One human-readable label/value pair for CLI stdout. */
export type HumanField = readonly [label: string, value: string];

function formatHumanLabel(label: string): string {
  const text = `${label}:`;
  return colors.cyan(text.padEnd(Math.max(HUMAN_LABEL_WIDTH, text.length)));
}

/**
 * Format one cyan-padded label/value line for human CLI output.
 *
 * @param label - Field label (without trailing colon).
 * @param value - Field value.
 * @returns A single formatted line.
 */
export function formatHumanField(label: string, value: string): string {
  return `${formatHumanLabel(label)} ${value}`;
}

/**
 * Format many label/value lines for human CLI output.
 *
 * @param fields - Label/value pairs.
 * @returns Formatted lines in the same order.
 */
export function formatHumanFields(fields: readonly HumanField[]): string[] {
  return fields.map(([label, value]) => formatHumanField(label, value));
}

/**
 * The "N. [Topic] Key: <key>" header line shared by `list`/`search` human-mode row rendering —
 * same topic coloring, ANSI-sanitization, and "(no topic)" fallback either way.
 *
 * @param index - Zero-based row index; displayed as `index + 1`.
 * @param topic - The row's topic, or `null` to show {@link NO_TOPIC_LABEL}.
 * @param cacheKey - The row's cache key.
 * @returns A single formatted line.
 */
export function formatResultRowHeader(
  index: number,
  topic: string | null,
  cacheKey: string
): string {
  const topicStr = topic ? colors.cyan(sanitizeForTerminal(topic)) : colors.gray(NO_TOPIC_LABEL);
  const keyStr = colors.bold(cacheKey);
  return `${index + 1}. [${topicStr}] Key: ${keyStr}`;
}
