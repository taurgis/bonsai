import { Args } from '@oclif/core';
import { BaseCommand } from '../base-command.js';
import { scanCacheDirs } from '../lib/research/storage.js';

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

  static args = {
    url: Args.string({
      required: true,
      description: 'the URL to inspect',
    }),
  };

  static stdoutIsPrimaryData = true;

  async run(): Promise<unknown> {
    const { url } = this.args;

    const target = this.resolveResearchTargetOrFail(url);

    const { cacheKey, located, normalizedUrl, roots } = target;

    if (!located) {
      // inspect makes no network call, so the bare message reads like the network-failure case the
      // exit-1 contract describes. Point at the fix instead: fetch the page so it lands in the cache.
      this.error(`No cached research found for URL: ${normalizedUrl}`, {
        exit: 1,
        code: 'CACHE_MISS',
        suggestions: [`Fetch and cache it first: ${this.config.bin} ${normalizedUrl}`],
      });
    }

    const cached = located.artifact;
    const artifactPath = located.path;
    const sections = this.findSections(roots.readRoots, cacheKey);

    if (!this.jsonEnabled()) {
      this.log(`${'Cache Key:'.padEnd(25)} ${cacheKey}`);
      this.log(`${'Cache Path:'.padEnd(25)} ${artifactPath}`);
      this.log(`--- Metadata ---`);
      for (const [key, val] of Object.entries(cached.metadata)) {
        const paddedKey = (key + ':').padEnd(Math.max(25, key.length + 2));
        if (typeof val === 'object' && val !== null) {
          this.log(`${paddedKey} ${JSON.stringify(val)}`);
        } else {
          this.log(`${paddedKey} ${val}`);
        }
      }
      if (sections.length) {
        this.log(`--- Sections (${sections.length}) ---`);
        for (const s of sections) {
          this.log(
            `${s.headingPath} [${s.anchor}] (${s.tokenEstimate.detailed} tokens) ${s.cacheKey}`
          );
        }
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
