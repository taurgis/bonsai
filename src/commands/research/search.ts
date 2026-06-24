import { Args, Flags } from '@oclif/core';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BaseCommand } from '../../base-command.js';
import { getArtifactPath } from '../../lib/research/storage.js';
import { parseArtifact } from '../../lib/research/artifact.js';
import { evaluateFreshness } from '../../lib/research/freshness.js';

export default class ResearchSearch extends BaseCommand<typeof ResearchSearch> {
  static id = 'research search';
  static summary = 'Search locally cached research artifacts by keywords.';
  static description =
    'Scans the local research cache database and ranks matching entries based on topic, tags, source URLs, summary, and content.';

  static args = {
    query: Args.string({
      required: true,
      description: 'The search query containing terms to match.',
    }),
  };

  static flags = {
    topic: Flags.string({
      char: 't',
      description: 'Filter results by exact topic (case-insensitive).',
    }),
    tags: Flags.string({
      char: 'g',
      description: 'Filter results by tags (must match all tags specified).',
      multiple: true,
    }),
    'artifact-type': Flags.option({
      description: 'Filter results by artifact type.',
      options: ['source', 'research_note'] as const,
    })(),
    limit: Flags.integer({
      description: 'Maximum number of results to return (default 10, max 50).',
      default: 10,
    }),
    'include-stale': Flags.boolean({
      description: 'Include stale expired cache entries in the search results.',
      default: false,
    }),
  };

  static stdoutIsPrimaryData = true;

  async init(): Promise<void> {
    await super.init();
    const { args, flags } = await this.parse(ResearchSearch);
    this.args = args;
    this.flags = flags;
  }

  private validateSearchFlags(): void {
    const limit = this.flags.limit;
    if (limit !== undefined && (limit < 1 || limit > 50)) {
      this.error('Limit must be between 1 and 50.', { exit: 2 });
    }
  }

  private getSearchQueryTerms(query: string): string[] {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) {
      this.error('Query string cannot be empty.', { exit: 2 });
    }
    return terms;
  }

  private matchesFilters(
    meta: any,
    freshness: string,
    topicFlag: string | undefined,
    tagsFlag: string[] | undefined,
    artTypeFlag: string | undefined,
    includeStale: boolean
  ): boolean {
    if (
      topicFlag &&
      (!meta.topic || meta.topic.trim().toLowerCase() !== topicFlag.trim().toLowerCase())
    ) {
      return false;
    }
    if (tagsFlag && tagsFlag.length > 0) {
      const metaTagsLower = (meta.tags || []).map((t: string) => t.toLowerCase());
      const hasAllTags = tagsFlag.every((t: string) => metaTagsLower.includes(t.toLowerCase()));
      if (!hasAllTags) {
        return false;
      }
    }
    if (artTypeFlag && meta.artifact_type !== artTypeFlag) {
      return false;
    }
    if (!includeStale && freshness === 'stale_expired') {
      return false;
    }
    return true;
  }

  private calculateScore(
    meta: any,
    summary: string,
    compressed: string,
    queryTerms: string[],
    freshness: string
  ): number {
    const topic = (meta.topic || '').toLowerCase();
    const tags = (meta.tags || []).map((t: string) => t.toLowerCase());
    const sourceUrl = (meta.source_url || '').toLowerCase();
    const sourceUrls = (meta.source_urls || []).map((u: string) => u.toLowerCase());
    const summ = summary.toLowerCase();
    const comp = compressed.toLowerCase();

    let score = 0;
    let matchedAny = false;
    for (const term of queryTerms) {
      const termScore = scoreSingleTerm(term, topic, tags, sourceUrl, sourceUrls, summ, comp);
      if (termScore > 0) {
        score += termScore;
        matchedAny = true;
      }
    }

    if (!matchedAny) return 0;

    if (freshness === 'fresh') {
      score += 30;
    } else if (freshness === 'stale_grace') {
      score += 10;
    }

    return score;
  }

  private makeSnippet(text: string, queryTerms: string[]): string {
    const lower = text.toLowerCase();
    let bestIdx = 0;
    for (const term of queryTerms) {
      const idx = lower.indexOf(term);
      if (idx !== -1) {
        bestIdx = idx;
        break;
      }
    }
    const start = Math.max(0, bestIdx - 40);
    const end = Math.min(text.length, bestIdx + 110);
    let snippet = text.slice(start, end).replace(/\s+/g, ' ').trim();
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';
    return snippet;
  }

  private scanCacheDirForResults(
    dir: string,
    dataDir: string,
    queryTerms: string[],
    currentTime: Date
  ): any[] {
    const results: any[] = [];
    if (!existsSync(dir)) {
      return results;
    }
    const files = readdirSync(dir);
    for (const file of files) {
      if (
        !file.endsWith('.md') ||
        file.includes('.tmp') ||
        file.includes('.corrupt') ||
        file.includes('.superseded')
      ) {
        continue;
      }
      try {
        const content = readFileSync(join(dir, file), 'utf-8');
        const artifact = parseArtifact(content);
        if (artifact.metadata.status !== 'active') continue;

        const freshness = evaluateFreshness(artifact.metadata, currentTime, null);

        if (
          !this.matchesFilters(
            artifact.metadata,
            freshness,
            this.flags.topic,
            this.flags.tags,
            this.flags['artifact-type'],
            Boolean(this.flags['include-stale'])
          )
        ) {
          continue;
        }

        const score = this.calculateScore(
          artifact.metadata,
          artifact.summary,
          artifact.compressed,
          queryTerms,
          freshness
        );

        if (score > 0) {
          const snippetText = [artifact.summary, artifact.compressed].filter(Boolean).join('\n');
          results.push({
            cacheKey: artifact.metadata.cache_key,
            path: getArtifactPath(dataDir, artifact.metadata.cache_key),
            artifactType: artifact.metadata.artifact_type,
            sourceUrls: artifact.metadata.source_urls,
            topic: artifact.metadata.topic,
            tags: artifact.metadata.tags,
            freshness,
            captureMethod: artifact.metadata.capture_method,
            tokenEstimate: artifact.metadata.token_estimate,
            snippet: this.makeSnippet(snippetText, queryTerms),
            score,
          });
        }
      } catch {}
    }
    return results;
  }

  private logSearchResults(finalResults: any[]): void {
    if (this.requestedJson()) return;
    this.log(`Found ${finalResults.length} matching cached research entries:\n`);
    finalResults.forEach((res, index) => {
      this.log(`${index + 1}. [${res.topic || 'No Topic'}] Score: ${res.score}`);
      this.log(`   Cache Key: ${res.cacheKey}`);
      this.log(`   Snippet: ${res.snippet}`);
      this.log(`   Source URLs: ${res.sourceUrls.join(', ')}\n`);
    });
  }

  async execute(): Promise<unknown> {
    const { query } = this.args;
    this.validateSearchFlags();
    const queryTerms = this.getSearchQueryTerms(query);

    const dataDir = this.config.dataDir;
    const dir = join(dataDir, 'research');
    const currentTime = new Date();

    const results = this.scanCacheDirForResults(dir, dataDir, queryTerms, currentTime);

    results.sort((a, b) => b.score - a.score);
    const finalResults = results.slice(0, this.flags.limit);

    this.logSearchResults(finalResults);

    return finalResults;
  }
}

function scoreSingleTerm(
  term: string,
  topic: string,
  tags: string[],
  sourceUrl: string,
  sourceUrls: string[],
  summ: string,
  comp: string
): number {
  let termScore = 0;
  let termMatched = false;
  if (topic === term) {
    termScore += 100;
    termMatched = true;
  }
  if (tags.includes(term)) {
    termScore += 80;
    termMatched = true;
  }
  if (sourceUrl.includes(term) || sourceUrls.some((u) => u.includes(term))) {
    termScore += 50;
    termMatched = true;
  }
  if (summ.includes(term)) {
    termScore += 20;
    termMatched = true;
  }
  if (comp.includes(term)) {
    termScore += 5;
    termMatched = true;
  }
  if (termMatched) {
    termScore += 10;
  }
  return termScore;
}
