import { Args } from '@oclif/core';
import { BaseCommand } from '../../base-command.js';
import { normalizeUrl } from '../../lib/research/url.js';
import { deriveCacheKey } from '../../lib/research/cache-key.js';
import { findArtifact, getArtifactPath } from '../../lib/research/storage.js';

export default class ResearchInspect extends BaseCommand<typeof ResearchInspect> {
  static id = 'research inspect';
  static summary = 'Inspect cached research metadata for a URL.';
  static description =
    'Inspects local storage and displays full frontmatter metadata for the URL (without printing the content body).';

  static args = {
    url: Args.string({
      required: true,
      description: 'The URL to inspect.',
    }),
  };

  static stdoutIsPrimaryData = true;

  async init(): Promise<void> {
    await super.init();
    const { args } = await this.parse(ResearchInspect);
    this.args = args;
  }

  async execute(): Promise<unknown> {
    const { url } = this.args;

    let normalizedUrl: string;
    let cacheKey: string;
    try {
      normalizedUrl = normalizeUrl(url);
      cacheKey = deriveCacheKey(normalizedUrl);
    } catch (err) {
      this.error(`Invalid URL: ${(err as Error).message}`, { exit: 2 });
    }

    const dataDir = this.config.dataDir;
    const cached = findArtifact(dataDir, cacheKey);

    if (!cached) {
      this.error(`No cached research found for URL: ${normalizedUrl}`, { exit: 1 });
    }

    const artifactPath = getArtifactPath(dataDir, cacheKey);

    if (!this.requestedJson()) {
      this.log(`Cache Key: ${cacheKey}`);
      this.log(`Cache Path: ${artifactPath}`);
      this.log(`--- Metadata ---`);
      for (const [key, val] of Object.entries(cached.metadata)) {
        if (typeof val === 'object' && val !== null) {
          this.log(`${key}: ${JSON.stringify(val)}`);
        } else {
          this.log(`${key}: ${val}`);
        }
      }
    }

    return {
      cacheKey,
      cachePath: artifactPath,
      metadata: cached.metadata,
    };
  }
}
