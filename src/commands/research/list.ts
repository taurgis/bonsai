import { Flags } from '@oclif/core';
import { join } from 'node:path';
import { BaseCommand } from '../../base-command.js';
import { getArtifactPath, scanCacheDir } from '../../lib/research/storage.js';
import { evaluateFreshness } from '../../lib/research/freshness.js';

export default class ResearchList extends BaseCommand<typeof ResearchList> {
  static id = 'research list';
  static summary = 'List cached research artifacts by metadata filters.';
  static description =
    'Lists cached research artifacts, including metadata details like path, source count, freshness, token estimates, and quality metrics without printing full content.';

  static examples = [
    {
      description: 'List all cached entries',
      command: '<%= config.bin %> research list',
    },
    {
      description: 'List cached entries for a specific topic with JSON output',
      command: '<%= config.bin %> research list --topic "React Suspense" --json',
    },
    {
      description: 'List only fresh entries filtered by tags',
      command: '<%= config.bin %> research list --freshness fresh --tags node --tags url',
    },
  ];

  static flags = {
    topic: Flags.string({
      char: 't',
      description: 'Filter by exact topic (case-insensitive).',
    }),
    tags: Flags.string({
      char: 'g',
      description: 'Filter by tags (must match all tags specified).',
      multiple: true,
    }),
    freshness: Flags.option({
      description: 'Filter by freshness state.',
      options: ['fresh', 'stale_grace', 'stale_expired'] as const,
    })(),
    'artifact-type': Flags.option({
      description: 'Filter by artifact type.',
      options: ['source', 'research_note'] as const,
    })(),
    'capture-method': Flags.option({
      description: 'Filter by capture method.',
      options: ['static_fetch', 'browser_fallback', 'agent_supplied'] as const,
    })(),
    limit: Flags.integer({
      description: 'Maximum number of results to return (default 50, max 100).',
      default: 50,
    }),
  };

  static stdoutIsPrimaryData = true;

  async init(): Promise<void> {
    await super.init();
    const { flags } = await this.parse(ResearchList);
    this.flags = flags;
  }

  private validateListFlags(): void {
    const limit = this.flags.limit;
    if (limit !== undefined && (limit < 1 || limit > 100)) {
      this.error('Limit must be between 1 and 100.', { exit: 2 });
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

  private scanCacheDirForList(dir: string, dataDir: string, currentTime: Date): any[] {
    return scanCacheDir(dir, (artifact) => {
      if (artifact.metadata.status !== 'active') return null;
      const freshness = evaluateFreshness(artifact.metadata, currentTime, null);
      if (!this.matchesFilters(artifact.metadata, freshness)) return null;
      return {
        cacheKey: artifact.metadata.cache_key,
        path: getArtifactPath(dataDir, artifact.metadata.cache_key),
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

  private logListResults(finalResults: any[]): void {
    if (this.requestedJson()) return;
    if (finalResults.length === 0) {
      this.log('No cached research entries found matching filters.');
      return;
    }
    this.log(`Found ${finalResults.length} cached research entries:\n`);
    finalResults.forEach((res, index) => {
      this.log(`${index + 1}. [${res.topic || 'No Topic'}] Key: ${res.cacheKey}`);
      this.log(`   Type: ${res.artifactType} | Freshness: ${res.freshness}`);
      this.log(
        `   Tokens: compressed=${res.tokenEstimate?.compressed || 0}, detailed=${res.tokenEstimate?.detailed || 0}`
      );
      this.log(`   Source URLs: ${res.sourceUrls.join(', ')}\n`);
    });
  }

  async execute(): Promise<unknown> {
    this.validateListFlags();

    const dataDir = this.config.dataDir;
    const dir = join(dataDir, 'research');
    const currentTime = new Date();

    const results = this.scanCacheDirForList(dir, dataDir, currentTime);

    // Sort by validated_at or fetched_at descending (most recent first)
    results.sort((a, b) => {
      const timeA = new Date(a.validatedAt || a.fetchedAt || 0).getTime();
      const timeB = new Date(b.validatedAt || b.fetchedAt || 0).getTime();
      return timeB - timeA;
    });

    const finalResults = results.slice(0, this.flags.limit);

    this.logListResults(finalResults);

    return finalResults;
  }
}
