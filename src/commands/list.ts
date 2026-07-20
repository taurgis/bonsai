import { Flags } from '@oclif/core';
import { BaseCommand } from '../base-command.js';
import { scanCacheDirs } from '../lib/research/storage.js';
import { loadStoreRoots } from '../lib/research/store-roots.js';
import { evaluateFreshness } from '../lib/research/freshness.js';
import {
  ARTIFACT_TYPES,
  CAPTURE_METHODS,
  type ResearchArtifactMetadata,
} from '../lib/research/schema.js';
import {
  NO_TOPIC_LABEL,
  resultListHeading,
  sanitizeForTerminal,
  type ResultListLabels,
} from '../lib/text.js';
import { limitFlag } from '../lib/limit-flag.js';
import { artifactMatchesUrlFilter, emptyUrlFilterError } from '../lib/research/url.js';
import { colors } from '../lib/color.js';
import { CLI_FLAG_DESCRIPTIONS } from '../lib/cli-presentation.js';
import type { ListRow } from '../lib/cli-result-types.js';

// Listings are ordered newest-first, so the truncation word is "first"; --limit caps at this value.
const LIST_DEFAULT_MAX_LIMIT = 100;
const LIST_LABELS: ResultListLabels = {
  noun: 'cached research',
  order: 'first',
  maxLimit: LIST_DEFAULT_MAX_LIMIT,
};

// `list` answers "what pages/notes do I have?" and deliberately omits section children (see
// scanCacheDirForList), so `section` is not an offered filter — every other artifact type can appear.
const LISTABLE_ARTIFACT_TYPES = ARTIFACT_TYPES.filter((type) => type !== 'section');

/** List cached research artifacts by metadata filters. */
export default class ResearchList extends BaseCommand<typeof ResearchList> {
  static id = 'list';
  static summary = 'List cached research artifacts by metadata';
  static description =
    'List page-level cached artifacts with source URLs, topic, tags, freshness, capture method, and token estimates.';

  /**
   * When `--json` results were capped by `--limit`, attached to the success envelope so agents can
   * detect truncation without scraping prose (#91 / AUDIT_71_FINAL #73 deferred).
   */
  private jsonTruncation: { totalMatched: number; shown: number; limit: number } | null = null;

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
  ];

  static flags = {
    topic: Flags.string({
      char: 't',
      description: CLI_FLAG_DESCRIPTIONS.filterTopic,
    }),
    tags: Flags.string({
      char: 'g',
      description: CLI_FLAG_DESCRIPTIONS.filterTags,
      multiple: true,
    }),
    url: Flags.string({
      description: CLI_FLAG_DESCRIPTIONS.sourceUrlGlob,
    }),
    freshness: Flags.option({
      description: 'freshness state',
      options: ['fresh', 'stale_grace', 'stale_expired'] as const,
    })(),
    'artifact-type': Flags.option({
      description: CLI_FLAG_DESCRIPTIONS.listArtifactType,
      options: LISTABLE_ARTIFACT_TYPES,
    })(),
    'capture-method': Flags.option({
      description: 'capture method',
      options: CAPTURE_METHODS,
    })(),
    limit: limitFlag(100, 50, 'result count (default 50, max 100)'),
  };

  static stdoutIsPrimaryData = true;

  private matchesTopic(meta: ResearchArtifactMetadata, topic: string | undefined): boolean {
    if (!topic) return true;
    return !!meta.topic && meta.topic.trim().toLowerCase() === topic.trim().toLowerCase();
  }

  private matchesTags(meta: ResearchArtifactMetadata, tags: string[] | undefined): boolean {
    if (!tags || tags.length === 0) return true;
    const metaTagsLower = meta.tags.map((t) => t.toLowerCase());
    return tags.every((t) => metaTagsLower.includes(t.toLowerCase()));
  }

  private matchesFilters(meta: ResearchArtifactMetadata, freshness: ListRow['freshness']): boolean {
    if (!this.matchesTopic(meta, this.flags.topic)) {
      return false;
    }
    if (!this.matchesTags(meta, this.flags.tags)) {
      return false;
    }
    if (this.flags.url && !artifactMatchesUrlFilter(meta, this.flags.url)) {
      return false;
    }
    if (this.flags['artifact-type'] && meta.artifact_type !== this.flags['artifact-type']) {
      return false;
    }
    if (this.flags['capture-method'] && meta.capture_method !== this.flags['capture-method']) {
      return false;
    }
    if (this.flags.freshness && freshness !== this.flags.freshness) {
      return false;
    }
    return true;
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
        // LISTABLE_ARTIFACT_TYPES just hides `section` from --artifact-type so no one filters for a
        // type list can never return. Keep both in sync if section handling ever changes.
        if (artifact.metadata.artifact_type === 'section') return null;
        const freshness = evaluateFreshness(artifact.metadata, currentTime, null);
        if (!this.matchesFilters(artifact.metadata, freshness)) return null;
        return {
          cacheKey: artifact.metadata.cache_key,
          path: filePath,
          artifactType: artifact.metadata.artifact_type,
          sourceUrls: artifact.metadata.source_urls,
          topic: artifact.metadata.topic,
          tags: artifact.metadata.tags,
          freshness,
          captureMethod: artifact.metadata.capture_method,
          tokenEstimate: artifact.metadata.token_estimate,
          qualityNotes: artifact.metadata.quality_notes,
          fetchedAt: artifact.metadata.fetched_at,
          validatedAt: artifact.metadata.validated_at,
        };
      },
      { persistIndex: !this.readOnly }
    );
  }

  private hasActiveFilters(): boolean {
    return Boolean(
      this.flags.topic ||
      (this.flags.tags && this.flags.tags.length > 0) ||
      this.flags.freshness ||
      this.flags['artifact-type'] ||
      this.flags['capture-method'] ||
      this.flags.url
    );
  }

  private logListResults(finalResults: ListRow[], totalMatched: number): void {
    if (finalResults.length === 0) {
      this.emitEmptyListGuidance();
      return;
    }
    if (this.jsonEnabled()) return;
    this.log(`${resultListHeading(totalMatched, finalResults.length, LIST_LABELS)}\n`);
    finalResults.forEach((res, index) => {
      const topicStr = res.topic
        ? colors.cyan(sanitizeForTerminal(res.topic))
        : colors.gray(NO_TOPIC_LABEL);
      const keyStr = colors.bold(res.cacheKey);
      this.log(`${index + 1}. [${topicStr}] Key: ${keyStr}`);

      const freshnessColorMap: Record<ListRow['freshness'], (t: string) => string> = {
        fresh: colors.green,
        stale_grace: colors.yellow,
        stale_expired: colors.red,
      };
      const freshnessColor = freshnessColorMap[res.freshness];
      const freshnessStr = freshnessColor(res.freshness);

      this.log(`   Type: ${colors.bold(res.artifactType)} | Freshness: ${freshnessStr}`);
      this.log(
        `   Tokens: compressed=${colors.bold(String(res.tokenEstimate?.compressed || 0))}, detailed=${colors.bold(String(res.tokenEstimate?.detailed || 0))}`
      );
      this.log(`   Source URLs: ${colors.gray(res.sourceUrls.join(', '))}\n`);
    });
  }

  /** Empty-cache / no-match tip (human mode only; --json returns `data: []` with no messaging). */
  private emitEmptyListGuidance(): void {
    if (this.jsonEnabled()) return;
    const filtered = this.hasActiveFilters();
    const headline = filtered
      ? 'No cached research entries match the given filters.'
      : 'No cached research entries found.';
    const tipCmd = filtered ? `${this.config.bin} list` : `${this.config.bin} <url>`;
    const tipLead = filtered
      ? 'try relaxing filters, or list everything: '
      : 'populate the cache first: ';
    this.log(headline);
    this.log(`\nTip: ${tipLead}${colors.cyan(tipCmd)}`);
  }

  async run(): Promise<ListRow[]> {
    const urlErr = emptyUrlFilterError(this.flags.url);
    if (urlErr) this.error(urlErr, { exit: 2, code: 'INVALID_FLAG_VALUE' });

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

    // Human heading carries truncation; --json gets an envelope `truncation` object when capped.
    this.jsonTruncation =
      results.length > finalResults.length
        ? {
            totalMatched: results.length,
            shown: finalResults.length,
            limit: this.flags.limit,
          }
        : null;
    this.logListResults(finalResults, results.length);

    return finalResults;
  }

  /** Attach `truncation` when the returned `data` array was capped by `--limit`. */
  protected override toSuccessJson(data: unknown): Record<string, unknown> {
    const envelope = this.baseSuccessJson(data);
    if (!this.jsonTruncation) return envelope;
    return { ...envelope, truncation: this.jsonTruncation };
  }
}
