import { Flags } from '@oclif/core';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { BaseCommand } from '../base-command.js';
import { scanCacheDir } from '../lib/research/storage.js';
import { loadStoreRoots } from '../lib/research/store-roots.js';
import { parseTtlToMs, durationFlagError } from '../lib/research/freshness.js';
import { pluralize } from '../lib/text.js';

export default class ResearchPrune extends BaseCommand<typeof ResearchPrune> {
  static id = 'prune';
  static summary = 'Clean up old or inactive research cache entries.';
  static description =
    'Prunes cached research entries based on age, inactivity, or artifact type to free up disk space.';

  static examples = [
    {
      description: 'Perform a dry run of pruning entries older than 90 days',
      command: '<%= config.bin %> prune --older-than 90d --dry-run',
    },
    {
      description: 'Actually prune entries older than 30 days that are source scrapes',
      command: '<%= config.bin %> prune --older-than 30d --artifact-type source --yes',
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
    // Validate durations up front: scanCacheDir swallows per-file errors, so a malformed
    // --older-than/--inactive would otherwise be silently ignored and report "0 entries".
    for (const msg of [
      durationFlagError('--older-than', this.flags['older-than']),
      durationFlagError('--inactive', this.flags.inactive),
    ]) {
      if (msg) this.error(msg, { exit: 2 });
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

  // Prune across every read root (project + global). No cross-root dedup: each file is a distinct
  // deletion target, so a cache key present in both locations is pruned in both.
  private findPruneCandidates(readRoots: string[], currentTime: Date): any[] {
    return readRoots.flatMap((dataDir) =>
      scanCacheDir(join(dataDir, 'research'), (artifact, filePath) => {
        if (!this.shouldPrune(artifact.metadata, currentTime)) return null;
        return {
          cacheKey: artifact.metadata.cache_key,
          path: filePath,
          topic: artifact.metadata.topic,
          url: artifact.metadata.source_url,
        };
      })
    );
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

  async run(): Promise<unknown> {
    this.validatePruneFlags();

    const roots = loadStoreRoots({
      configDir: this.config.configDir,
      cwd: process.cwd(),
      dataDir: this.config.dataDir,
    });
    const currentTime = new Date();

    const filesToPrune = this.findPruneCandidates(roots.readRoots, currentTime);
    const dryRun = this.flags['dry-run'];
    const count = filesToPrune.length;

    // Track deletions actually performed so the JSON envelope and human output agree even when an
    // unlink fails (e.g. a permission error). Reporting candidate count as `prunedCount` would
    // overstate success and mislead an agent branching on the result.
    let prunedCount = 0;
    if (dryRun) {
      if (!this.jsonEnabled()) {
        const noun = pluralize(count, 'entry', 'entries');
        this.log(`[Dry Run] Found ${count} research cache ${noun} that would be pruned:\n`);
        filesToPrune.forEach((f) => {
          this.log(`- [${f.topic || 'No Topic'}] Key: ${f.cacheKey} (${f.url || 'Imported note'})`);
        });
      }
    } else {
      prunedCount = this.deletePruneCandidates(filesToPrune);
      if (!this.jsonEnabled()) {
        const noun = pluralize(count, 'entry', 'entries');
        this.log(`Successfully pruned ${prunedCount} of ${count} research cache ${noun}.`);
      }
    }

    return {
      dryRun,
      prunedCount,
      candidateCount: count,
      files: filesToPrune.map((f) => ({
        cacheKey: f.cacheKey,
        path: f.path,
      })),
    };
  }
}
