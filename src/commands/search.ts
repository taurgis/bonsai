import { Flags } from '@oclif/core';
import { BaseCommand } from '../base-command.js';
import { scanCacheDirs } from '../lib/research/storage.js';
import { loadStoreRoots } from '../lib/research/store-roots.js';
import { evaluateFreshness } from '../lib/research/freshness.js';
import type { ResearchArtifactMetadata } from '../lib/research/schema.js';
import {
  formatTip,
  resultListHeading,
  sanitizeForTerminal,
  type ResultListLabels,
} from '../lib/text.js';
import { limitFlag } from '../lib/limit-flag.js';
import { countByFreshness, toListRow } from '../lib/research/list-row.js';
import { emptyUrlFilterError } from '../lib/research/url.js';
import {
  matchesCommonMetadataFilters,
  hasActiveMetadataFilters,
  emptyTopicFilterError,
  emptyTagsFilterError,
  type CommonMetadataFilterFlags,
} from '../lib/research/metadata-filters.js';
import { commonMetadataFilterFlags } from '../lib/common-metadata-filter-flags.js';
import { buildNextLimitCommand } from '../lib/next-command.js';
import {
  tokenizeSearchQuery,
  emptySearchQueryError,
  scoreSearchMatch,
  extractSearchSnippet,
  type SearchMatch,
} from '../lib/research/search-match.js';
import { colors, FRESHNESS_COLOR } from '../lib/color.js';
import { CLI_FLAG_DESCRIPTIONS, formatResultRowHeader } from '../lib/cli-presentation.js';
import type { SearchRow, SearchRowMinimal, SearchSummary } from '../lib/cli-result-types.js';

const SEARCH_DEFAULT_MAX_LIMIT = 100;
// A small default (matching `list`'s) keeps a broad query from flooding an agent's context;
// `summary.truncated`/`nextCommand` (and the human-mode tip) make raising --limit an explicit,
// deliberate next step rather than a silent, unbounded dump.
const SEARCH_DEFAULT_LIMIT = 10;

const NO_MATCH_SCORE: SearchMatch = { score: 0, matchedFields: [] };

/** Project a full row down to the default minimal shape (see {@link SearchRowMinimal}). */
function toMinimalSearchRow(row: SearchRow): SearchRowMinimal {
  return {
    sourceUrls: row.sourceUrls,
    topic: row.topic,
    freshness: row.freshness,
    tokenEstimate: row.tokenEstimate,
    score: row.score,
    matchedFields: row.matchedFields,
    snippet: row.snippet,
  };
}

/** Search cached research artifacts by tag/content keywords and metadata filters. */
export default class ResearchSearch extends BaseCommand<typeof ResearchSearch> {
  static id = 'search';
  static summary = 'Search cached research artifacts by tags and content';
  static description =
    'Rank cached page-level artifacts by a --query matched against topic, tags, summary, and ' +
    'compressed content, plus the same metadata filters as `list` (topic, tags, URL, freshness, ' +
    'artifact type, capture method). Reads only the token-cheap indexed summary/compressed text, ' +
    'never the full detailed body, so ranking a large cache stays fast. Pass --full for every ' +
    'metadata field.';

  /** Aggregate counts (and an explicit empty/truncation signal); see `list.ts`'s equivalent. */
  private jsonSummary: SearchSummary | null = null;

  static examples = [
    {
      description: 'search content and tags for a keyword',
      command: '<%= config.bin %> search --query "suspense boundary"',
    },
    {
      description: 'match any of several terms instead of requiring all',
      command: '<%= config.bin %> search --query "suspense streaming" --match-any',
    },
    {
      description: 'combine a query with metadata filters',
      command: '<%= config.bin %> search --query cache --tags react --freshness fresh',
    },
    {
      description: 'filter by tags/topic alone, ranked like list (no --query)',
      command: '<%= config.bin %> search --tags node --json',
    },
  ];

  static flags = {
    query: Flags.string({
      char: 'q',
      description: CLI_FLAG_DESCRIPTIONS.searchQuery,
    }),
    'match-any': Flags.boolean({
      default: false,
      description: CLI_FLAG_DESCRIPTIONS.searchMatchAny,
    }),
    ...commonMetadataFilterFlags(CLI_FLAG_DESCRIPTIONS.searchArtifactType),
    limit: limitFlag(
      SEARCH_DEFAULT_MAX_LIMIT,
      SEARCH_DEFAULT_LIMIT,
      `result count (max ${SEARCH_DEFAULT_MAX_LIMIT}, default ${SEARCH_DEFAULT_LIMIT})`
    ),
    full: Flags.boolean({
      default: false,
      description: CLI_FLAG_DESCRIPTIONS.searchFull,
    }),
  };

  static stdoutIsPrimaryData = true;

  /** The shared filter flags as `matchesCommonMetadataFilters`/`hasActiveMetadataFilters` expect them. */
  private metadataFilterFlags(): CommonMetadataFilterFlags {
    return {
      topic: this.flags.topic,
      tags: this.flags.tags,
      url: this.flags.url,
      artifactType: this.flags['artifact-type'],
      captureMethod: this.flags['capture-method'],
      freshness: this.flags.freshness,
    };
  }

  private matchesMetadataFilters(
    meta: ResearchArtifactMetadata,
    freshness: SearchRow['freshness']
  ): boolean {
    return matchesCommonMetadataFilters(meta, freshness, this.metadataFilterFlags());
  }

  private scanCacheDirForSearch(
    readRoots: string[],
    currentTime: Date,
    terms: readonly string[]
  ): SearchRow[] {
    const matchAny = this.flags['match-any'];
    // Honor effective read-only: searching must not persist the derived search-index sidecar.
    return scanCacheDirs(
      readRoots,
      (artifact, filePath): SearchRow | null => {
        if (artifact.metadata.status !== 'active') return null;
        // Page-level only, same reasoning as `list`: sections are sub-chunks of a page, not
        // artifacts a user "has" — find them via `inspect` instead.
        if (artifact.metadata.artifact_type === 'section') return null;
        const freshness = evaluateFreshness(artifact.metadata, currentTime, null);
        if (!this.matchesMetadataFilters(artifact.metadata, freshness)) return null;

        let match = NO_MATCH_SCORE;
        let snippet: string | null = null;
        if (terms.length > 0) {
          const scored = scoreSearchMatch(
            {
              topic: artifact.metadata.topic,
              tags: artifact.metadata.tags,
              summary: artifact.summary,
              compressed: artifact.compressed,
            },
            terms,
            matchAny
          );
          if (!scored) return null;
          match = scored;
          snippet = extractSearchSnippet(
            { summary: artifact.summary, compressed: artifact.compressed },
            terms
          );
        }

        return {
          ...toListRow(artifact, filePath, freshness),
          score: match.score,
          matchedFields: match.matchedFields,
          snippet,
        };
      },
      { persistIndex: !this.readOnly }
    );
  }

  /** Newest-first (no query) or highest-score-first (query given), both tie-broken by cache key. */
  private sortResults(results: SearchRow[], queried: boolean): void {
    results.sort((a, b) => {
      if (queried && b.score !== a.score) return b.score - a.score;
      const timeA = new Date(a.validatedAt || a.fetchedAt || 0).getTime();
      const timeB = new Date(b.validatedAt || b.fetchedAt || 0).getTime();
      if (timeB !== timeA) return timeB - timeA;
      return a.cacheKey.localeCompare(b.cacheKey);
    });
  }

  private hasActiveFilters(): boolean {
    return Boolean(this.flags.query) || hasActiveMetadataFilters(this.metadataFilterFlags());
  }

  private logSearchResults(
    finalResults: SearchRow[],
    totalMatched: number,
    queried: boolean,
    nextCommand: string | null
  ): void {
    if (finalResults.length === 0) {
      this.emitEmptySearchGuidance();
      return;
    }
    if (this.jsonEnabled()) return;

    const labels: ResultListLabels = queried
      ? { noun: 'matching cached research', order: 'top' }
      : { noun: 'cached research', order: 'first' };
    this.log(`${resultListHeading(totalMatched, finalResults.length, labels)}\n`);

    finalResults.forEach((res, index) => {
      this.log(formatResultRowHeader(index, res.topic, res.cacheKey));

      const freshnessStr = FRESHNESS_COLOR[res.freshness](res.freshness);
      const scoreStr = queried ? ` | Score: ${colors.bold(String(res.score))}` : '';
      this.log(`   Type: ${colors.bold(res.artifactType)} | Freshness: ${freshnessStr}${scoreStr}`);

      if (queried && res.matchedFields.length > 0) {
        this.log(`   Matched: ${colors.gray(res.matchedFields.join(', '))}`);
      }
      if (res.snippet) {
        this.log(`   Snippet: ${colors.gray(sanitizeForTerminal(res.snippet))}`);
      }
      this.log(
        `   Tokens: compressed=${colors.bold(String(res.tokenEstimate?.compressed || 0))}, detailed=${colors.bold(String(res.tokenEstimate?.detailed || 0))}`
      );
      this.log(`   Source URLs: ${colors.gray(res.sourceUrls.join(', '))}\n`);
    });
    if (nextCommand) {
      this.tip(`see the rest: ${colors.cyan(nextCommand)}`);
    }
  }

  /**
   * Empty-cache / no-match tip (human mode only). Under `--json`/`--toon`, `data: []` is paired with
   * `summary.empty: true` instead of prose — see {@link toSuccessJson}.
   */
  private emitEmptySearchGuidance(): void {
    if (this.jsonEnabled()) return;
    const filtered = this.hasActiveFilters();
    const headline = filtered
      ? 'No cached research entries match the given search.'
      : 'No cached research entries found.';
    const tipCmd = filtered ? `${this.config.bin} search` : `${this.config.bin} <url>`;
    const tipLead = filtered
      ? 'try a broader --query, --match-any, or relax other filters: '
      : 'populate the cache first: ';
    this.log(headline);
    this.log(`\n${formatTip(`${tipLead}${colors.cyan(tipCmd)}`)}`);
  }

  async run(): Promise<SearchRow[] | SearchRowMinimal[]> {
    const flagErr =
      emptyUrlFilterError(this.flags.url) ??
      emptyTopicFilterError(this.flags.topic) ??
      emptyTagsFilterError(this.flags.tags) ??
      emptySearchQueryError(this.flags.query);
    if (flagErr) this.error(flagErr, { exit: 2, code: 'INVALID_FLAG_VALUE' });

    const roots = loadStoreRoots({
      configDir: this.config.configDir,
      cwd: process.cwd(),
      dataDir: this.config.dataDir,
    });
    const currentTime = new Date();
    const terms = this.flags.query ? tokenizeSearchQuery(this.flags.query) : [];
    const queried = terms.length > 0;

    const results = this.scanCacheDirForSearch(roots.readRoots, currentTime, terms);
    this.sortResults(results, queried);

    const finalResults = results.slice(0, this.flags.limit);
    const truncated = results.length > finalResults.length;
    // Suggest exactly enough to see every match, capped at the command's own max — a caller who
    // truncated at the default can raise --limit once and be done, rather than guessing a value.
    const nextCommand = truncated
      ? buildNextLimitCommand(
          this.config.bin,
          'search',
          this.argv,
          Math.min(results.length, SEARCH_DEFAULT_MAX_LIMIT)
        )
      : null;

    this.jsonSummary = {
      total: results.length,
      shown: finalResults.length,
      limit: this.flags.limit,
      truncated,
      empty: results.length === 0,
      byFreshness: countByFreshness(results),
      queried,
      nextCommand,
    };
    this.logSearchResults(finalResults, results.length, queried, nextCommand);

    return this.flags.full ? finalResults : finalResults.map(toMinimalSearchRow);
  }

  /** Attach the aggregate `summary` computed in `run()` (see {@link SearchSummary}). */
  protected override toSuccessJson(data: unknown): Record<string, unknown> {
    const envelope = this.baseSuccessJson(data);
    if (!this.jsonSummary) return envelope;
    return { ...envelope, summary: this.jsonSummary };
  }
}
