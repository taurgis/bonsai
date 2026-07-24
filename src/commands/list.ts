import { Flags } from '@oclif/core';
import { homedir } from 'node:os';
import { BaseCommand } from '../base-command.js';
import { scanCacheDirs } from '../lib/research/storage.js';
import { loadStoreRoots } from '../lib/research/store-roots.js';
import { evaluateFreshness } from '../lib/research/freshness.js';
import type { ResearchArtifactMetadata } from '../lib/research/schema.js';
import {
  collapseHomeDir,
  formatTip,
  resultListHeading,
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
import { colors, FRESHNESS_COLOR } from '../lib/color.js';
import { CLI_FLAG_DESCRIPTIONS, formatResultRowHeader } from '../lib/cli-presentation.js';
import type { ListRow, ListRowMinimal, ListSummary } from '../lib/cli-result-types.js';

// Listings are ordered newest-first, so the truncation word is "first"; --limit caps at this value.
const LIST_DEFAULT_MAX_LIMIT = 100;
// A small default keeps an unfiltered `list` from flooding an agent's context with everything ever
// cached; `summary.truncated`/`nextCommand` (and the human-mode tip) make raising --limit an
// explicit, deliberate next step rather than a silent, unbounded dump.
const LIST_DEFAULT_LIMIT = 10;
const LIST_LABELS: ResultListLabels = {
  noun: 'cached research',
  order: 'first',
};

/** Project a full row down to the default minimal shape (see {@link ListRowMinimal}). */
function toMinimalListRow(row: ListRow): ListRowMinimal {
  return {
    sourceUrls: row.sourceUrls,
    topic: row.topic,
    freshness: row.freshness,
    tokenEstimate: row.tokenEstimate,
  };
}

/** List cached research artifacts by metadata filters. */
export default class ResearchList extends BaseCommand<typeof ResearchList> {
  static id = 'list';
  static summary = 'List cached research artifacts by metadata';
  static description =
    'List page-level cached artifacts by source URL, topic, freshness, and token estimate. ' +
    'Pass --full for every metadata field (cache key, path, artifact type, tags, capture method, quality notes, timestamps).';

  /**
   * Aggregate counts (and an explicit empty/truncation signal) attached to the success envelope so
   * agents get a cache-wide summary without a separate round trip (AXI principles: pre-computed
   * aggregates, definitive empty states). Always set by `run()` before it returns.
   */
  private jsonSummary: ListSummary | null = null;

  static examples = [
    {
      description: 'list cached entries',
      command: '<%= config.bin %> list',
    },
    {
      description: 'list entries for a topic as JSON',
      command: '<%= config.bin %> list --topic "React Suspense" --json',
    },
    {
      description: 'list fresh entries matching tags',
      command: '<%= config.bin %> list --freshness fresh --tags node --tags url',
    },
    {
      description: 'list entries matching a URL glob',
      command: '<%= config.bin %> list --url "https://react.dev/*"',
    },
    {
      description: 'list every metadata field instead of the minimal default row',
      command: '<%= config.bin %> list --full --json',
    },
  ];

  static flags = {
    ...commonMetadataFilterFlags(CLI_FLAG_DESCRIPTIONS.listArtifactType),
    limit: limitFlag(
      LIST_DEFAULT_MAX_LIMIT,
      LIST_DEFAULT_LIMIT,
      `result count (max ${LIST_DEFAULT_MAX_LIMIT}, default ${LIST_DEFAULT_LIMIT})`
    ),
    full: Flags.boolean({
      default: false,
      description: CLI_FLAG_DESCRIPTIONS.listFull,
    }),
    // Only ever set by the argv rewrite for a truly bare `bonsai` invocation (see normalizeArgv);
    // hidden because it is not documented or intended for direct use.
    identity: Flags.boolean({ default: false, hidden: true }),
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

  private matchesFilters(meta: ResearchArtifactMetadata, freshness: ListRow['freshness']): boolean {
    return matchesCommonMetadataFilters(meta, freshness, this.metadataFilterFlags());
  }

  private scanCacheDirForList(readRoots: string[], currentTime: Date): ListRow[] {
    // Honor effective read-only: listing must not persist the derived search-index sidecar.
    return scanCacheDirs(
      readRoots,
      (artifact, filePath): ListRow | null => {
        if (artifact.metadata.status !== 'active') return null;
        // Section children are sub-chunks of a page, not artifacts a user "has" — they would flood the
        // listing (one page yields dozens) and aren't in the documented source/research_note contract.
        // They stay discoverable through `inspect` (which lists a page's sections). `list` answers "what pages/notes do I have?", so keep it page-level. This
        // unconditional guard owns the exclusion (the default no-filter case relies on it);
        // PAGE_LEVEL_ARTIFACT_TYPES just hides `section` from --artifact-type so no one filters for a
        // type list can never return. Keep both in sync if section handling ever changes.
        if (artifact.metadata.artifact_type === 'section') return null;
        const freshness = evaluateFreshness(artifact.metadata, currentTime, null);
        if (!this.matchesFilters(artifact.metadata, freshness)) return null;
        return toListRow(artifact, filePath, freshness);
      },
      { persistIndex: !this.readOnly }
    );
  }

  /**
   * Identity header for the AXI "home view" (bare `bonsai`, no args): the tool's own bin path and
   * one-sentence description, shown before the live data so an agent orients on what it's looking
   * at without a separate `--help` round trip. Human mode only — the hidden `--identity` flag is
   * only ever set by the argv rewrite for a bare invocation; it is not documented for direct use.
   */
  private logIdentityHeader(): void {
    if (!this.flags.identity || this.jsonEnabled()) return;
    const binPath = collapseHomeDir(process.argv[1] ?? this.config.bin, homedir());
    this.log(`bin: ${binPath}`);
    this.log(`description: ${this.config.pjson.description ?? this.config.bin}\n`);
  }

  private logListResults(
    finalResults: ListRow[],
    totalMatched: number,
    nextCommand: string | null
  ): void {
    if (finalResults.length === 0) {
      this.emitEmptyListGuidance();
      return;
    }
    if (this.jsonEnabled()) return;
    this.log(`${resultListHeading(totalMatched, finalResults.length, LIST_LABELS)}\n`);
    finalResults.forEach((res, index) => {
      this.log(formatResultRowHeader(index, res.topic, res.cacheKey));

      const freshnessStr = FRESHNESS_COLOR[res.freshness](res.freshness);

      this.log(`   Type: ${colors.bold(res.artifactType)} | Freshness: ${freshnessStr}`);
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
  private emitEmptyListGuidance(): void {
    if (this.jsonEnabled()) return;
    const filtered = hasActiveMetadataFilters(this.metadataFilterFlags());
    const headline = filtered
      ? 'No cached research entries match the given filters.'
      : 'No cached research entries found.';
    const tipCmd = filtered ? `${this.config.bin} list` : `${this.config.bin} <url>`;
    const tipLead = filtered
      ? 'try relaxing filters, or list everything: '
      : 'populate the cache first: ';
    this.log(headline);
    this.log(`\n${formatTip(`${tipLead}${colors.cyan(tipCmd)}`)}`);
    // Bare `bonsai` (no args) redirects here (content-first default), so an empty, unfiltered cache
    // is also the first thing a brand-new user sees — point at --help so command discovery isn't lost.
    if (!filtered) {
      this.log(formatTip(`see every command: ${colors.cyan(`${this.config.bin} --help`)}`));
    }
  }

  async run(): Promise<ListRow[] | ListRowMinimal[]> {
    const flagErr =
      emptyUrlFilterError(this.flags.url) ??
      emptyTopicFilterError(this.flags.topic) ??
      emptyTagsFilterError(this.flags.tags);
    if (flagErr) this.error(flagErr, { exit: 2, code: 'INVALID_FLAG_VALUE' });

    this.logIdentityHeader();

    const roots = loadStoreRoots({
      configDir: this.config.configDir,
      cwd: process.cwd(),
      dataDir: this.config.dataDir,
    });
    const currentTime = new Date();

    const results = this.scanCacheDirForList(roots.readRoots, currentTime);

    results.sort((a, b) => {
      const timeA = new Date(a.validatedAt || a.fetchedAt || 0).getTime();
      const timeB = new Date(b.validatedAt || b.fetchedAt || 0).getTime();
      return timeB - timeA;
    });

    const finalResults = results.slice(0, this.flags.limit);
    const truncated = results.length > finalResults.length;
    // Suggest exactly enough to see every match, capped at the command's own max — a caller who
    // truncated at the default can raise --limit once and be done, rather than guessing a value.
    const nextCommand = truncated
      ? buildNextLimitCommand(
          this.config.bin,
          'list',
          this.argv,
          Math.min(results.length, LIST_DEFAULT_MAX_LIMIT)
        )
      : null;

    // Human heading carries truncation inline; --json/--toon get the same counts (plus a freshness
    // breakdown and an explicit `empty` flag) as an always-present envelope `summary` object.
    this.jsonSummary = {
      total: results.length,
      shown: finalResults.length,
      limit: this.flags.limit,
      truncated,
      empty: results.length === 0,
      byFreshness: countByFreshness(results),
      nextCommand,
    };
    this.logListResults(finalResults, results.length, nextCommand);

    return this.flags.full ? finalResults : finalResults.map(toMinimalListRow);
  }

  /** Attach the aggregate `summary` computed in `run()` (see {@link ListSummary}). */
  protected override toSuccessJson(data: unknown): Record<string, unknown> {
    const envelope = this.baseSuccessJson(data);
    if (!this.jsonSummary) return envelope;
    return { ...envelope, summary: this.jsonSummary };
  }
}
