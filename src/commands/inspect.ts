import { Args } from '@oclif/core';
import { BaseCommand } from '../base-command.js';
import { finalizeBatch, isBatchReadFailure, urlValidationErrorRow } from '../lib/batch.js';
import { getArtifactPath, scanCacheDirs } from '../lib/research/storage.js';
import { colors } from '../lib/color.js';
import type { ResolvedResearchTarget } from '../lib/research/resolve-target.js';
import { formatHumanField, formatHumanFields } from '../lib/cli-presentation.js';

interface SectionSummary {
  cacheKey: string;
  anchor: string | null;
  headingPath: string | null;
  tokenEstimate: { compressed: number | null; detailed: number | null };
}

export default class ResearchInspect extends BaseCommand<typeof ResearchInspect> {
  static id = 'inspect';
  static summary = 'Inspect cached research metadata for a URL.';
  static description =
    'Inspects local storage and displays full frontmatter metadata for the URL (without printing the content body).';

  static examples = [
    {
      description: 'inspect cached research metadata for a specific URL',
      command: '<%= config.bin %> <%= command.id %> https://example.com/docs',
    },
    {
      description: 'output the full metadata as JSON for use by other tools',
      command: '<%= config.bin %> <%= command.id %> https://example.com/docs --json',
    },
  ];

  static strict = false;

  static args = {
    url: Args.string({
      required: true,
      description: 'the URL to inspect',
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

  private inspectOne(url: string) {
    const target = this.resolveResearchTargetOrFail(url);
    return target.located ? this.hitResult(target) : this.missResult(target);
  }

  private missResult(target: ResolvedResearchTarget) {
    const artifactPath = getArtifactPath(target.roots.writeRoot, target.cacheKey);
    if (!this.jsonEnabled()) {
      for (const line of formatHumanFields([
        ['URL', colors.bold(target.normalizedUrl)],
        ['Cache Key', colors.bold(target.cacheKey)],
        ['Cache Path', colors.gray(artifactPath)],
        ['Status', colors.red('miss')],
      ])) {
        this.log(line);
      }
      this.warn(`Cache miss — run: ${this.config.bin} ${target.normalizedUrl}`);
      if (this.parsedArgv.length > 1) this.log('='.repeat(40));
    }
    return {
      cacheKey: target.cacheKey,
      cachePath: artifactPath,
      normalizedUrl: target.normalizedUrl,
      status: 'miss' as const,
      metadata: null,
      sections: [] as SectionSummary[],
    };
  }

  private hitResult(target: ResolvedResearchTarget) {
    const { cacheKey, located, roots, normalizedUrl } = target;
    const cached = located!.artifact;
    const artifactPath = located!.path;
    const sections = this.findSections(roots.readRoots, cacheKey);

    if (!this.jsonEnabled()) {
      for (const line of formatHumanFields([
        ['URL', colors.bold(normalizedUrl)],
        ['Cache Key', colors.bold(cacheKey)],
        ['Cache Path', colors.gray(artifactPath)],
      ])) {
        this.log(line);
      }
      this.logMetadata(cached.metadata);
      if (sections.length) this.logSections(sections);
      if (this.parsedArgv.length > 1) this.log('='.repeat(40));
    }

    return {
      cacheKey,
      cachePath: artifactPath,
      normalizedUrl,
      status: 'hit' as const,
      metadata: cached.metadata,
      sections,
    };
  }

  private logMetadata(metadata: Record<string, any>): void {
    this.log(colors.cyan(`--- Metadata ---`));
    for (const [key, val] of Object.entries(metadata)) {
      if (typeof val === 'object' && val !== null) {
        this.log(formatHumanField(key, colors.bold(JSON.stringify(val))));
      } else {
        this.log(formatHumanField(key, colors.bold(String(val))));
      }
    }
  }

  private logSections(sections: SectionSummary[]): void {
    this.log(colors.cyan(`--- Sections (${sections.length}) ---`));
    for (const s of sections) {
      this.log(
        `${colors.cyan(s.headingPath || '')} [${colors.yellow(s.anchor || '')}] (${colors.magenta(String(s.tokenEstimate.detailed || 0))} tokens) ${colors.gray(s.cacheKey)}`
      );
    }
  }

  // Section children link back via parent_cache_key; list the active ones for this page (T-22).
  private findSections(readRoots: string[], parentKey: string): SectionSummary[] {
    return scanCacheDirs<SectionSummary>(readRoots, (artifact) => {
      const meta = artifact.metadata;
      if (meta.parent_cache_key !== parentKey || meta.status !== 'active') return null;
      return {
        cacheKey: meta.cache_key,
        anchor: meta.section_anchor,
        headingPath: meta.section_heading_path,
        tokenEstimate: meta.token_estimate,
      };
    }).sort((a, b) => (a.headingPath ?? '').localeCompare(b.headingPath ?? ''));
  }
}
