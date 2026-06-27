import { Flags } from '@oclif/core';
import { BaseCommand } from '../base-command.js';
import { scanCacheDirs } from '../lib/research/storage.js';
import { loadStoreRoots } from '../lib/research/store-roots.js';
import { evaluateFreshness } from '../lib/research/freshness.js';
import { ARTIFACT_TYPES, CAPTURE_METHODS } from '../lib/research/schema.js';
import {
  NO_TOPIC_LABEL,
  resultListHeading,
  truncationNotice,
  type ResultListLabels,
} from '../lib/text.js';

// Listings are ordered newest-first, so the truncation word is "first"; --limit caps at 100.
const LIST_LABELS: ResultListLabels = { noun: 'cached research', order: 'first', maxLimit: 100 };

// `list` answers "what pages/notes do I have?" and deliberately omits section children (see
// scanCacheDirForList), so `section` is not an offered filter — every other artifact type can appear.
const LISTABLE_ARTIFACT_TYPES = ARTIFACT_TYPES.filter((type) => type !== 'section');

export default class ResearchList extends BaseCommand<typeof ResearchList> {
  static id = 'list';
  static summary = 'List cached research artifacts by metadata filters.';
  static description =
    'Lists cached research artifacts, including metadata details like path, source count, freshness, token estimates, and quality metrics without printing full content.';

  static examples = [
    {
      description: 'list all cached entries',
      command: '<%= config.bin %> list',
    },
    {
      description: 'list cached entries for a specific topic with JSON output',
      command: '<%= config.bin %> list --topic "React Suspense" --json',
    },
    {
      description: 'list only fresh entries filtered by tags',
      command: '<%= config.bin %> list --freshness fresh --tags node --tags url',
    },
  ];

  static flags = {
    topic: Flags.string({
      char: 't',
      description: 'filter by exact topic (case-insensitive)',
    }),
    tags: Flags.string({
      char: 'g',
      description: 'filter by tags (must match all tags specified)',
      multiple: true,
    }),
    freshness: Flags.option({
      description: 'filter by freshness state',
      options: ['fresh', 'stale_grace', 'stale_expired'] as const,
    })(),
    'artifact-type': Flags.option({
      description: 'filter by artifact type',
      options: LISTABLE_ARTIFACT_TYPES,
    })(),
    'capture-method': Flags.option({
      description: 'filter by capture method',
      options: CAPTURE_METHODS,
    })(),
    limit: Flags.integer({
      description: 'maximum number of results to return (default 50, max 100)',
      default: 50,
    }),
  };

  static stdoutIsPrimaryData = true;

  private validateListFlags(): void {
    const limit = this.flags.limit;
    if (limit !== undefined && (limit < 1 || limit > 100)) {
      this.error('Limit must be between 1 and 100.', { exit: 2, code: 'INVALID_LIMIT' });
    }
  }

  private matchesFilters(meta: any, freshness: string): boolean {
    if (
      this.flags.topic &&
      (!meta.topic || meta.topic.trim().toLowerCase() !== this.flags.topic.trim().toLowerCase())
    ) {
      return false;
    }
    if (this.flags.tags && this.flags.tags.length > 0) {
      const metaTagsLower = (meta.tags || []).map((t: string) => t.toLowerCase());
      const hasAllTags = this.flags.tags.every((t: string) =>
        metaTagsLower.includes(t.toLowerCase())
      );
      if (!hasAllTags) {
        return false;
      }
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

  private scanCacheDirForList(readRoots: string[], currentTime: Date): any[] {
    return scanCacheDirs(readRoots, (artifact, filePath) => {
      if (artifact.metadata.status !== 'active') return null;
      // Section children are sub-chunks of a page, not artifacts a user "has" — they would flood the
      // listing (one page yields dozens) and aren't in the documented source/research_note contract.
      // They stay discoverable through `search` (which ranks them) and `inspect` (which lists a
      // page's sections). `list` answers "what pages/notes do I have?", so keep it page-level. This
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
    });
  }

  private logListResults(finalResults: any[], totalMatched: number): void {
    if (this.jsonEnabled()) return;
    if (finalResults.length === 0) {
      this.log('No cached research entries found matching filters.');
      this.log(`\nTip: populate the cache first: ${this.config.bin} <url>`);
      return;
    }
    this.log(`${resultListHeading(totalMatched, finalResults.length, LIST_LABELS)}\n`);
    finalResults.forEach((res, index) => {
      this.log(`${index + 1}. [${res.topic || NO_TOPIC_LABEL}] Key: ${res.cacheKey}`);
      this.log(`   Type: ${res.artifactType} | Freshness: ${res.freshness}`);
      this.log(
        `   Tokens: compressed=${res.tokenEstimate?.compressed || 0}, detailed=${res.tokenEstimate?.detailed || 0}`
      );
      this.log(`   Source URLs: ${res.sourceUrls.join(', ')}\n`);
    });
  }

  async run(): Promise<unknown> {
    this.validateListFlags();

    const roots = loadStoreRoots({
      configDir: this.config.configDir,
      cwd: process.cwd(),
      dataDir: this.config.dataDir,
    });
    const currentTime = new Date();

    const results = this.scanCacheDirForList(roots.readRoots, currentTime);

    // Sort by validated_at or fetched_at descending (most recent first)
    results.sort((a, b) => {
      const timeA = new Date(a.validatedAt || a.fetchedAt || 0).getTime();
      const timeB = new Date(b.validatedAt || b.fetchedAt || 0).getTime();
      return timeB - timeA;
    });

    const finalResults = results.slice(0, this.flags.limit);

    // Under --json the human heading is suppressed, so surface truncation on stderr instead (warn
    // always emits, even in --json) without touching the stdout envelope. Human mode already shows
    // it in the heading, so only warn under --json.
    const notice = truncationNotice(results.length, finalResults.length, LIST_LABELS);
    if (notice && this.jsonEnabled()) this.warn(notice);

    this.logListResults(finalResults, results.length);

    return finalResults;
  }
}
