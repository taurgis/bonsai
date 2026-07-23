import { Args } from '@oclif/core';
import { BaseCommand } from '../base-command.js';
import { finalizeBatch, isBatchReadFailure, urlValidationErrorRow } from '../lib/batch.js';
import { batchSeparator, cacheMissHint, formatCacheTargetHeader } from '../lib/cache-view.js';
import { getArtifactPath, scanCacheDirs } from '../lib/research/storage.js';
import { artifactMatchesUrlFilter } from '../lib/research/url.js';
import { colors } from '../lib/color.js';
import type { ResolvedResearchTarget } from '../lib/research/resolve-target.js';
import { formatHumanField } from '../lib/cli-presentation.js';
import { sanitizeForTerminal } from '../lib/text.js';
import type { ResearchArtifactMetadata } from '../lib/research/schema.js';
import type {
  InspectExistingNoteRow,
  InspectRow,
  InspectSectionRow,
} from '../lib/cli-result-types.js';

/** Inspect a cached artifact and its section children. */
export default class ResearchInspect extends BaseCommand<typeof ResearchInspect> {
  static id = 'inspect';
  static summary = 'Inspect cached research metadata for a URL';
  static description =
    'Show frontmatter metadata and section children for cached URLs without printing content.';

  static examples = [
    {
      description: 'inspect cached metadata for a URL',
      command: '<%= config.bin %> <%= command.id %> https://example.com/docs',
    },
    {
      description: 'inspect cached metadata as JSON',
      command: '<%= config.bin %> <%= command.id %> https://example.com/docs --json',
    },
    {
      description: 'inspect multiple URLs in one batch (space-separated)',
      command:
        '<%= config.bin %> <%= command.id %> https://example.com/docs https://example.com/api',
    },
  ];

  static strict = false;

  static args = {
    url: Args.string({
      required: true,
      description: 'URL to inspect',
    }),
  };

  static stdoutIsPrimaryData = true;

  protected override toSuccessJson(data: unknown): Record<string, unknown> {
    return this.batchReadSuccessJson(data);
  }

  async run(): Promise<unknown> {
    const results = this.mapUrlsAllowingBatchErrors(
      this.parsedArgv,
      (url) => this.inspectOne(url),
      urlValidationErrorRow
    );
    return finalizeBatch(results, isBatchReadFailure);
  }

  private inspectOne(url: string): InspectRow {
    const target = this.resolveResearchTargetOrFail(url);
    return target.located ? this.hitResult(target) : this.missResult(target);
  }

  private missResult(target: ResolvedResearchTarget): InspectRow {
    const artifactPath = getArtifactPath(target.roots.writeRoot, target.cacheKey);
    const existingNote = this.findExistingNoteContaining(
      target.roots.readRoots,
      target.normalizedUrl
    );
    if (!this.jsonEnabled()) {
      for (const line of formatCacheTargetHeader(
        target,
        [['Status', colors.red('miss')]],
        artifactPath
      )) {
        this.log(line);
      }
      this.warn(this.missGuidance(target.normalizedUrl, existingNote));
      const sep = batchSeparator(this.parsedArgv.length > 1);
      if (sep) this.log(sep);
    }
    return {
      cacheKey: target.cacheKey,
      cachePath: artifactPath,
      normalizedUrl: target.normalizedUrl,
      status: 'miss',
      metadata: null,
      sections: [],
      partOfExistingNote: existingNote,
    };
  }

  // A URL with no cache key of its own can still be a secondary `--source-url` of an already
  // imported multi-source research_note (those key off topic+content, not any one URL — see
  // docs/reference/cache-protocol.md). Without this check, the generic "fetch and cache it" miss
  // hint would steer the caller into creating an unrelated duplicate entry instead of finding the
  // note that already covers this URL (discoverable today via `list --url`).
  //
  // ponytail: `status` and `fetch` have the same blind spot on a miss (they'd still suggest a
  // fetch/refetch for a URL that's really a secondary source of an existing note) but aren't
  // patched here — `status` is meant to stay a cheap pre-flight check, and `fetch`'s miss path
  // already does real work (an actual network fetch) rather than just reporting a status, so
  // adding a full cache scan to either changes their cost profile more than this fix's scope
  // warrants. Extend this same scan to those commands if the gap proves costly in practice.
  private findExistingNoteContaining(
    readRoots: string[],
    normalizedUrl: string
  ): InspectExistingNoteRow | null {
    const matches = scanCacheDirs<InspectExistingNoteRow>(
      readRoots,
      (artifact) => {
        const meta = artifact.metadata;
        if (meta.status !== 'active') return null;
        if (!artifactMatchesUrlFilter(meta, normalizedUrl)) return null;
        return {
          cacheKey: meta.cache_key,
          artifactType: meta.artifact_type,
          topic: meta.topic,
          sourceUrls: meta.source_urls,
        };
      },
      { persistIndex: !this.readOnly }
    );
    return matches[0] ?? null;
  }

  private missGuidance(normalizedUrl: string, existingNote: InspectExistingNoteRow | null): string {
    if (!existingNote) return cacheMissHint(this.config.bin, normalizedUrl);
    return [
      `${normalizedUrl} has no cache entry of its own, but it is a source of an existing ${existingNote.artifactType} (cache key: ${existingNote.cacheKey}).`,
      `Find it with: ${this.config.bin} list --url "${normalizedUrl}"`,
    ].join('\n');
  }

  private hitResult(target: ResolvedResearchTarget): InspectRow {
    const { cacheKey, located, roots, normalizedUrl } = target;
    const cached = located!.artifact;
    const artifactPath = located!.path;
    const sections = this.findSections(roots.readRoots, cacheKey);

    if (!this.jsonEnabled()) {
      for (const line of formatCacheTargetHeader(target, [], artifactPath)) {
        this.log(line);
      }
      this.logMetadata(cached.metadata);
      if (sections.length) this.logSections(sections);
      this.tip(`${this.config.bin} status ${normalizedUrl} to check freshness.`);
      const sep = batchSeparator(this.parsedArgv.length > 1);
      if (sep) this.log(sep);
    }

    return {
      cacheKey,
      cachePath: artifactPath,
      normalizedUrl,
      status: 'hit',
      metadata: cached.metadata,
      sections,
    };
  }

  private logMetadata(metadata: ResearchArtifactMetadata): void {
    this.log(colors.cyan(`--- Metadata ---`));
    for (const [key, val] of Object.entries(metadata)) {
      if (typeof val === 'object' && val !== null) {
        this.log(formatHumanField(key, colors.bold(JSON.stringify(val))));
      } else {
        const display = typeof val === 'string' ? sanitizeForTerminal(val) : String(val);
        this.log(formatHumanField(key, colors.bold(display)));
      }
    }
  }

  private logSections(sections: InspectSectionRow[]): void {
    this.log(colors.cyan(`--- Sections (${sections.length}) ---`));
    for (const s of sections) {
      const headingPath = sanitizeForTerminal(s.headingPath || '');
      const anchor = sanitizeForTerminal(s.anchor || '');
      this.log(
        `${colors.cyan(headingPath)} [${colors.yellow(anchor)}] (${colors.magenta(String(s.tokenEstimate.detailed || 0))} tokens) ${colors.gray(s.cacheKey)}`
      );
    }
  }

  // Section children link back via parent_cache_key; list the active ones for this page (T-22).
  private findSections(readRoots: string[], parentKey: string): InspectSectionRow[] {
    return scanCacheDirs<InspectSectionRow>(
      readRoots,
      (artifact) => {
        const meta = artifact.metadata;
        if (meta.parent_cache_key !== parentKey || meta.status !== 'active') return null;
        return {
          cacheKey: meta.cache_key,
          anchor: meta.section_anchor,
          headingPath: meta.section_heading_path,
          tokenEstimate: meta.token_estimate,
        };
      },
      { persistIndex: !this.readOnly }
    ).sort((a, b) => (a.headingPath ?? '').localeCompare(b.headingPath ?? ''));
  }
}
