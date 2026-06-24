import { Flags } from '@oclif/core';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { BaseCommand } from '../../base-command.js';
import { scanCacheDir } from '../../lib/research/storage.js';
import { parseTtlToMs } from '../../lib/research/freshness.js';

export default class ResearchPrune extends BaseCommand<typeof ResearchPrune> {
  static id = 'research prune';
  static summary = 'Clean up old or inactive research cache entries.';
  static description =
    'Prunes cached research entries based on age, inactivity, or artifact type to free up disk space.';

  static examples = [
    {
      description: 'Perform a dry run of pruning entries older than 90 days',
      command: '<%= config.bin %> research prune --older-than 90d --dry-run',
    },
    {
      description: 'Actually prune entries older than 30 days that are source scrapes',
      command: '<%= config.bin %> research prune --older-than 30d --artifact-type source --yes',
    },
  ];

  static flags = {
    'older-than': Flags.string({
      description: 'Prune entries older than duration (e.g. "30d", "90d").',
    }),
    inactive: Flags.string({
      description:
        'Prune entries inactive (unvalidated/unfetched) for duration (e.g. "14d", "30d").',
    }),
    'artifact-type': Flags.option({
      description: 'Filter pruning to specific artifact type.',
      options: ['source', 'research_note'] as const,
    })(),
    'dry-run': Flags.boolean({
      description: 'List files that would be deleted without actually deleting them.',
      default: false,
    }),
    yes: Flags.boolean({
      char: 'y',
      description: 'Skip confirmation prompt and prune files.',
      default: false,
    }),
  };

  static stdoutIsPrimaryData = true;

  async init(): Promise<void> {
    await super.init();
    const { flags } = await this.parse(ResearchPrune);
    this.flags = flags;
  }

  private validatePruneFlags(): void {
    if (!this.flags['older-than'] && !this.flags.inactive && !this.flags['artifact-type']) {
      this.error(
        'Must specify at least one pruning filter: --older-than, --inactive, or --artifact-type.',
        { exit: 2 }
      );
    }
    if (!this.flags['dry-run'] && !this.flags.yes) {
      this.error(
        'Safety check: Please specify --yes to confirm pruning, or --dry-run to list files that would be deleted.',
        { exit: 2 }
      );
    }
  }

  private shouldPrune(meta: any, currentTime: Date): boolean {
    const fetched = meta.fetched_at ? new Date(meta.fetched_at).getTime() : 0;
    const validated = meta.validated_at ? new Date(meta.validated_at).getTime() : 0;
    const baseTime = Math.max(fetched, validated);
    const ageMs = currentTime.getTime() - baseTime;

    if (this.flags['artifact-type'] && meta.artifact_type !== this.flags['artifact-type']) {
      return false;
    }

    if (this.flags['older-than']) {
      const olderThanMs = parseTtlToMs(this.flags['older-than']);
      if (ageMs < olderThanMs) {
        return false;
      }
    }

    if (this.flags.inactive) {
      const inactiveMs = parseTtlToMs(this.flags.inactive);
      if (ageMs < inactiveMs) {
        return false;
      }
    }

    return true;
  }

  private findPruneCandidates(dir: string, currentTime: Date): any[] {
    return scanCacheDir(dir, (artifact, filePath) => {
      if (!this.shouldPrune(artifact.metadata, currentTime)) return null;
      return {
        cacheKey: artifact.metadata.cache_key,
        path: filePath,
        topic: artifact.metadata.topic,
        url: artifact.metadata.source_url,
      };
    });
  }

  private deletePruneCandidates(filesToPrune: any[]): number {
    let prunedCount = 0;
    for (const f of filesToPrune) {
      try {
        unlinkSync(f.path);
        prunedCount++;
      } catch (err) {
        this.warn(`Failed to delete cache file ${f.path}: ${(err as Error).message}`);
      }
    }
    return prunedCount;
  }

  async execute(): Promise<unknown> {
    this.validatePruneFlags();

    const dataDir = this.config.dataDir;
    const dir = join(dataDir, 'research');
    const currentTime = new Date();

    const filesToPrune = this.findPruneCandidates(dir, currentTime);
    const dryRun = this.flags['dry-run'];
    const count = filesToPrune.length;

    if (dryRun) {
      if (!this.requestedJson()) {
        this.log(`[Dry Run] Found ${count} research cache entries that would be pruned:\n`);
        filesToPrune.forEach((f) => {
          this.log(`- [${f.topic || 'No Topic'}] Key: ${f.cacheKey} (${f.url || 'Imported note'})`);
        });
      }
    } else {
      const prunedCount = this.deletePruneCandidates(filesToPrune);
      if (!this.requestedJson()) {
        this.log(`Successfully pruned ${prunedCount} of ${count} research cache entries.`);
      }
    }

    return {
      dryRun,
      prunedCount: dryRun ? 0 : filesToPrune.length,
      candidateCount: filesToPrune.length,
      files: filesToPrune.map((f) => ({
        cacheKey: f.cacheKey,
        path: f.path,
      })),
    };
  }
}
