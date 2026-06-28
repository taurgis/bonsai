import { Args } from '@oclif/core';
import { BaseCommand } from '../base-command.js';
import { scanCacheDirs } from '../lib/research/storage.js';
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

  async run(): Promise<unknown> {
    const urls = this.parsedArgv;

    const results: any[] = [];
    const missingUrls: string[] = [];

    for (const url of urls) {
      const target = this.resolveResearchTargetOrFail(url);
      if (!target.located) {
        missingUrls.push(target.normalizedUrl);
        continue;
      }
      results.push(this.inspectSingleTarget(target, urls.length > 1));
    }

    if (missingUrls.length > 0) {
      const firstMissing = missingUrls[0]!;
      const suggestions = missingUrls.map(
        (u) => `Fetch and cache it first: ${this.config.bin} ${u}`
      );
      this.error(
        `No cached research found for URL: ${firstMissing}` +
          (missingUrls.length > 1 ? ` and ${missingUrls.length - 1} other URLs` : ''),
        {
          exit: 1,
          code: 'CACHE_MISS',
          suggestions,
        }
      );
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

  private inspectSingleTarget(target: any, showSeparator: boolean): any {
    const { cacheKey, located, roots } = target;
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
