import { Args } from '@oclif/core';
import { BaseCommand } from '../base-command.js';
import { enrichCacheMissEnvelope } from '../lib/envelope.js';
import { getArtifactPath, scanCacheDirs } from '../lib/research/storage.js';
import { colors } from '../lib/color.js';

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

  /** Match status: keep hit payloads when any URL misses, and surface CACHE_MISS on the envelope. */
  protected override toSuccessJson(data: unknown): Record<string, unknown> {
    return enrichCacheMissEnvelope(super.toSuccessJson(data), data, this.config.bin, (url, n) =>
      n > 1
        ? `No cached research found for URL: ${url} and ${n - 1} other URLs`
        : `No cached research found for URL: ${url}`
    );
  }

  async run(): Promise<unknown> {
    const urls = this.parsedArgv;

    const results: any[] = [];
    let hasMiss = false;

    for (const url of urls) {
      const target = this.resolveResearchTargetOrFail(url);
      if (!target.located) {
        hasMiss = true;
        results.push(this.missResult(target, urls.length > 1));
        continue;
      }
      results.push(this.inspectSingleTarget(target, urls.length > 1));
    }

    if (hasMiss) {
      process.exitCode = 1;
    }

    return urls.length === 1 ? results[0] : results;
  }

  private logMetadata(metadata: Record<string, any>): void {
    this.log(colors.cyan(`--- Metadata ---`));
    for (const [key, val] of Object.entries(metadata)) {
      const paddedKey = colors.cyan((key + ':').padEnd(Math.max(25, key.length + 2)));
      if (typeof val === 'object' && val !== null) {
        this.log(`${paddedKey} ${colors.bold(JSON.stringify(val))}`);
      } else {
        this.log(`${paddedKey} ${colors.bold(String(val))}`);
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

  private missResult(
    target: { cacheKey: string; normalizedUrl: string; roots: { writeRoot: string } },
    showSeparator: boolean
  ): any {
    const artifactPath = getArtifactPath(target.roots.writeRoot, target.cacheKey);
    if (!this.jsonEnabled()) {
      this.log(`${colors.cyan('URL:'.padEnd(25))} ${colors.bold(target.normalizedUrl)}`);
      this.log(`${colors.cyan('Cache Key:'.padEnd(25))} ${colors.bold(target.cacheKey)}`);
      this.log(`${colors.cyan('Cache Path:'.padEnd(25))} ${colors.gray(artifactPath)}`);
      this.log(`${colors.cyan('Status:'.padEnd(25))} ${colors.red('miss')}`);
      this.warn(`Cache miss — run: ${this.config.bin} ${target.normalizedUrl}`);
      if (showSeparator) {
        this.log('='.repeat(40));
      }
    }
    return {
      cacheKey: target.cacheKey,
      cachePath: artifactPath,
      normalizedUrl: target.normalizedUrl,
      status: 'miss',
      metadata: null,
      sections: [],
    };
  }

  private inspectSingleTarget(target: any, showSeparator: boolean): any {
    const { cacheKey, located, roots, normalizedUrl } = target;
    const cached = located.artifact;
    const artifactPath = located.path;
    const sections = this.findSections(roots.readRoots, cacheKey);

    if (!this.jsonEnabled()) {
      this.log(`${colors.cyan('Cache Key:'.padEnd(25))} ${colors.bold(cacheKey)}`);
      this.log(`${colors.cyan('Cache Path:'.padEnd(25))} ${colors.gray(artifactPath)}`);
      this.logMetadata(cached.metadata);
      if (sections.length) {
        this.logSections(sections);
      }
      if (showSeparator) {
        this.log('='.repeat(40));
      }
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
