import { Flags } from '@oclif/core';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { BaseCommand } from '../base-command.js';
import { enrichPrunePartialEnvelope } from '../lib/envelope.js';
import { scanCacheDir } from '../lib/research/storage.js';
import { loadStoreRoots } from '../lib/research/store-roots.js';
import { parseTtlToMs } from '../lib/research/freshness.js';
import { ARTIFACT_TYPES } from '../lib/research/schema.js';
import { NO_TOPIC_LABEL, pluralize } from '../lib/text.js';
import { artifactMatchesUrlFilter } from '../lib/research/url.js';
import { pruneFlagError } from '../lib/prune-flags.js';
import { colors } from '../lib/color.js';
import { CLI_FLAG_DESCRIPTIONS } from '../lib/cli-presentation.js';

export default class ResearchPrune extends BaseCommand<typeof ResearchPrune> {
  static id = 'prune';
  static summary = 'Prune cached research artifacts';
  static description =
    'Delete cached artifacts by content age, idle time, URL glob, or artifact type.';

  static examples = [
    {
      description: 'preview pruning entries older than 30 days',
      command: '<%= config.bin %> prune --older-than 30d --dry-run',
    },
    {
      description: 'prune source artifacts older than 30 days',
      command: '<%= config.bin %> prune --older-than 30d --artifact-type source --yes',
    },
    {
      description: 'prune entries matching a URL glob',
      command: '<%= config.bin %> prune --url "https://react.dev/*" --yes',
    },
  ];

  static flags = {
    'older-than': Flags.string({
      description: 'content age threshold (fetched_at, else validated_at), e.g. "30d"',
    }),
    inactive: Flags.string({
      description: 'idle time threshold (validated_at, else fetched_at), e.g. "14d"',
    }),
    url: Flags.string({
      description: CLI_FLAG_DESCRIPTIONS.sourceUrlGlob,
    }),
    'artifact-type': Flags.option({
      // Prune operates on every cached file, so it can target any artifact type — including the
      // `section`/`index` children a page generates (e.g. to clear orphans left after a source is
      // pruned with `--artifact-type source`).
      description: CLI_FLAG_DESCRIPTIONS.pruneArtifactType,
      options: ARTIFACT_TYPES,
    })(),
    'dry-run': Flags.boolean({
      description: 'preview files without deleting',
      default: false,
    }),
    yes: Flags.boolean({
      char: 'y',
      description: 'confirm deletion (required unless --dry-run)',
      default: false,
    }),
  };

  static stdoutIsPrimaryData = true;

  protected override toSuccessJson(data: unknown): Record<string, unknown> {
    return enrichPrunePartialEnvelope(this.baseSuccessJson(data), data);
  }

  private validatePruneFlags(): void {
    const err = pruneFlagError({
      olderThan: this.flags['older-than'],
      inactive: this.flags.inactive,
      artifactType: this.flags['artifact-type'],
      url: this.flags.url,
      dryRun: this.flags['dry-run'],
      yes: this.flags.yes,
      readOnly: this.readOnly,
      bin: this.config.bin,
    });
    if (err) this.error(err.message, { exit: 2, code: err.code, suggestions: err.suggestions });
  }

  private shouldPrune(meta: any, currentTime: Date): boolean {
    if (this.flags['artifact-type'] && meta.artifact_type !== this.flags['artifact-type']) {
      return false;
    }

    if (this.flags.url && !artifactMatchesUrlFilter(meta, this.flags.url)) {
      return false;
    }

    const now = currentTime.getTime();
    // Content age (fetched_at, else validated_at) vs idle time (validated_at, else fetched_at) are
    // deliberately distinct so a recently revalidated but originally-old page can match --older-than
    // without also being treated as inactive.
    if (
      this.flags['older-than'] &&
      ageMs(meta, now, 'content') < parseTtlToMs(this.flags['older-than'])
    ) {
      return false;
    }
    if (this.flags.inactive && ageMs(meta, now, 'idle') < parseTtlToMs(this.flags.inactive)) {
      return false;
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
    const dryRun = this.effectiveDryRun(this.flags['dry-run']);
    const count = filesToPrune.length;

    // Track deletions actually performed so the JSON envelope and human output agree even when an
    // unlink fails (e.g. a permission error). Reporting candidate count as `prunedCount` would
    // overstate success and mislead an agent branching on the result.
    let prunedCount = 0;
    if (dryRun) {
      if (!this.jsonEnabled()) {
        if (count === 0) {
          this.log(colors.yellow('[Dry Run] No research cache entries match the given filters.'));
        } else {
          const noun = pluralize(count, 'entry', 'entries');
          this.log(
            colors.yellow(`[Dry Run] Found ${count} research cache ${noun} that would be pruned:\n`)
          );
          filesToPrune.forEach((f) => {
            this.log(
              `- [${f.topic ? colors.cyan(f.topic) : colors.gray(NO_TOPIC_LABEL)}] Key: ${colors.bold(f.cacheKey)} (${colors.gray(f.url || 'Imported note')})`
            );
          });
        }
      }
    } else {
      prunedCount = this.deletePruneCandidates(filesToPrune);
      if (!this.jsonEnabled()) {
        const noun = pluralize(count, 'entry', 'entries');
        this.log(
          colors.green(`Successfully pruned ${prunedCount} of ${count} research cache ${noun}.`)
        );
      }
      // Partial unlink failure is a runtime outcome agents must see: exit 1 with the counts still
      // in `data` so callers can tell candidates from successes without parsing stderr warnings.
      if (count > 0 && prunedCount < count) {
        process.exitCode = 1;
      }
    }

    return {
      dryRun,
      status: dryRun ? 'would_prune' : 'pruned',
      wouldPruneCount: dryRun ? count : 0,
      prunedCount,
      candidateCount: count,
      files: filesToPrune.map((f) => ({
        cacheKey: f.cacheKey,
        path: f.path,
      })),
    };
  }
}

/** Age in ms for prune filters. `content` prefers fetched_at; `idle` prefers validated_at. */
function ageMs(
  meta: { fetched_at?: string | null; validated_at?: string | null },
  now: number,
  kind: 'content' | 'idle'
): number {
  const fetched = meta.fetched_at ? new Date(meta.fetched_at).getTime() : 0;
  const validated = meta.validated_at ? new Date(meta.validated_at).getTime() : 0;
  const base = kind === 'content' ? fetched || validated : validated || fetched;
  return now - base;
}
