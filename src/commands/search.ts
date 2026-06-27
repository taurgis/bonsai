import { Args, Flags, ux } from '@oclif/core';
import { BaseCommand } from '../base-command.js';
import { loadSearchableArtifacts } from '../lib/research/search-index.js';
import {
  levenshtein,
  resultListHeading,
  truncationNotice,
  type ResultListLabels,
} from '../lib/text.js';
import { loadStoreRoots } from '../lib/research/store-roots.js';
import { evaluateFreshness } from '../lib/research/freshness.js';
import { ARTIFACT_TYPES } from '../lib/research/schema.js';
import { detectSite } from '../sites/index.js';
import { fetchStaticHtml, fetchText, postJson } from '../lib/research/fetcher.js';
import {
  runRemoteDocsSearch,
  type RemoteSearchDeps,
} from '../lib/research/docs/remote-search-runner.js';

// Results are ranked, so the truncation word is "top"; --limit caps at 50.
const SEARCH_LABELS: ResultListLabels = {
  noun: 'matching cached research',
  order: 'top',
  maxLimit: 50,
};

const REMOTE_SEARCH_DEPS: RemoteSearchDeps = {
  fetchStatic: async (url) => {
    const res = await fetchStaticHtml(url);
    return { content: res.content, finalUrl: res.finalUrl };
  },
  fetchText: async (url) => {
    const res = await fetchText(url);
    return { content: res.content, status: res.status };
  },
  postJson: (url, body, headers) => postJson(url, body, headers),
};

const FRESHNESS_BONUS: Record<string, number> = { fresh: 30, stale_grace: 10 };

export default class ResearchSearch extends BaseCommand<typeof ResearchSearch> {
  static id = 'search';
  static summary = 'Search locally cached research artifacts by keywords.';
  static description =
    'Scans the local research cache database and ranks matching entries based on topic, tags, source URLs, summary, and content.';

  static examples = [
    {
      description: 'search for cached notes containing specific keywords',
      command: '<%= config.bin %> <%= command.id %> "authentication flow"',
    },
    {
      description: 'search with remote docs fallback',
      command: '<%= config.bin %> <%= command.id %> "router" --remote https://react.dev',
    },
    {
      description: 'search local cache with tag filtering',
      command: '<%= config.bin %> <%= command.id %> "setup" --tags node --tags tutorial',
    },
  ];

  static args = {
    query: Args.string({
      required: true,
      description: 'the search query containing terms to match',
    }),
  };

  static flags = {
    topic: Flags.string({
      char: 't',
      description: 'filter results by exact topic (case-insensitive)',
    }),
    tags: Flags.string({
      char: 'g',
      description: 'filter results by tags (must match all tags specified)',
      multiple: true,
    }),
    'artifact-type': Flags.option({
      description: 'filter results by artifact type',
      options: ARTIFACT_TYPES,
    })(),
    limit: Flags.integer({
      description: 'maximum number of results to return (default 10, max 50)',
      default: 10,
    }),
    'include-stale': Flags.boolean({
      description: 'include stale expired cache entries in the search results',
      default: false,
    }),
    domain: Flags.string({
      description: 'search a documentation site directly (requires compatible site module)',
    }),
    remote: Flags.string({
      description: 'discover uncached docs via public search or index (falls back to local cache)',
    }),
  };

  static stdoutIsPrimaryData = true;

  private validateSearchFlags(): void {
    const limit = this.flags.limit;
    if (limit !== undefined && (limit < 1 || limit > 50)) {
      this.error('Limit must be between 1 and 50.', { exit: 2, code: 'INVALID_LIMIT' });
    }
  }

  private getSearchQueryTerms(query: string): string[] {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) {
      this.error('Query string cannot be empty.', { exit: 2, code: 'EMPTY_QUERY' });
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

  private phraseMatchBonus(
    topic: string,
    tags: string[],
    summ: string,
    comp: string,
    queryTerms: string[]
  ): number {
    if (queryTerms.length <= 1) return 0;
    const fullQuery = queryTerms.join(' ');
    let bonus = 0;
    if (topic === fullQuery) bonus += 200;
    if (topic.includes(fullQuery)) bonus += 100;
    if (tags.includes(fullQuery)) bonus += 150;
    if (summ.includes(fullQuery)) bonus += 50 + Math.min(summ.split(fullQuery).length - 1, 5) * 10;
    if (comp.includes(fullQuery)) bonus += 20 + Math.min(comp.split(fullQuery).length - 1, 10) * 5;
    return bonus;
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

    score += this.phraseMatchBonus(topic, tags, summ, comp, queryTerms);
    score += FRESHNESS_BONUS[freshness] ?? 0;
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
    readRoots: string[],
    queryTerms: string[],
    currentTime: Date
  ): any[] {
    const results: any[] = [];
    for (const { artifact, filePath } of loadSearchableArtifacts(readRoots)) {
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
      )
        continue;
      let score = this.calculateScore(
        artifact.metadata,
        artifact.summary,
        artifact.compressed,
        queryTerms,
        freshness
      );
      if (score <= 0) continue;
      // Section children are more precise than the whole page, so rank a section hit slightly
      // above its parent for the same query (T-22).
      if (artifact.metadata.artifact_type === 'section') score += 15;
      const snippetText = [artifact.summary, artifact.compressed].filter(Boolean).join('\n');
      results.push({
        cacheKey: artifact.metadata.cache_key,
        path: filePath,
        artifactType: artifact.metadata.artifact_type,
        sourceUrls: artifact.metadata.source_urls,
        topic: artifact.metadata.topic,
        tags: artifact.metadata.tags,
        freshness,
        captureMethod: artifact.metadata.capture_method,
        tokenEstimate: artifact.metadata.token_estimate,
        snippet: this.makeSnippet(snippetText, queryTerms),
        siteModuleId: artifact.metadata.site_module_id,
        score,
      });
    }
    return results;
  }

  private logSearchResults(finalResults: any[], totalMatched: number): void {
    if (this.jsonEnabled()) return;
    if (finalResults.length === 0) {
      this.log('No matching cached research entries found.');
      this.log(`\nTip: populate the cache first: ${this.config.bin} <url>`);
      return;
    }
    this.log(`${resultListHeading(totalMatched, finalResults.length, SEARCH_LABELS)}\n`);
    finalResults.forEach((res, index) => {
      this.log(`${index + 1}. [${res.topic || 'No Topic'}] Score: ${res.score}`);
      this.log(`   Cache Key: ${res.cacheKey}`);
      this.log(`   Snippet: ${res.snippet}`);
      this.log(`   Source URLs: ${res.sourceUrls.join(', ')}\n`);
    });
  }

  // Prints a numbered result list to stdout for human (non-JSON) output. Shared by site and remote
  // search so the two paths can't drift in formatting.
  private printResults(
    heading: string,
    results: ReadonlyArray<{ title: string; url: string; snippet?: string }>
  ): void {
    if (this.jsonEnabled()) return;
    this.log(heading);
    results.forEach((r, i) => {
      this.log(`${i + 1}. ${r.title}`);
      this.log(`   URL: ${r.url}`);
      if (r.snippet) this.log(`   ${r.snippet}`);
    });
  }

  private async executeSiteSearch(query: string, domain: string): Promise<unknown> {
    const siteModule = detectSite(`https://${domain}`);
    if (!siteModule) {
      this.error(`No site module registered for domain: ${domain}`, {
        exit: 2,
        code: 'UNSUPPORTED_DOMAIN',
      });
    }
    if (!siteModule.search) {
      this.error(`Site module '${siteModule.id}' does not implement search.`, {
        exit: 2,
        code: 'SEARCH_NOT_SUPPORTED',
      });
    }
    try {
      if (!this.jsonEnabled()) ux.action.start(`Searching ${domain}`);
      const results = await siteModule.search(query);
      if (!this.jsonEnabled()) ux.action.stop();
      this.printResults(`Found ${results.length} results from ${siteModule.name}:\n`, results);
      return results.map((r) => ({ ...r, site_module_id: siteModule.id }));
    } catch (err) {
      if (!this.jsonEnabled()) ux.action.stop('failed');
      throw err;
    }
  }

  // Remote docs discovery. On any connector failure, degrade to local cache search with a warning
  // (T-20). Returns discovery results tagged remote: true so callers can tell them from cache hits.
  private async executeRemoteSearch(query: string, docsUrl: string): Promise<unknown> {
    try {
      if (!this.jsonEnabled()) ux.action.start(`Searching ${docsUrl}`);
      const { provider, results } = await runRemoteDocsSearch(docsUrl, query, REMOTE_SEARCH_DEPS);
      if (!this.jsonEnabled()) ux.action.stop();
      this.printResults(`Found ${results.length} remote results via ${provider}:\n`, results);
      return results.map((r) => ({ ...r, remote: true }));
    } catch (err) {
      if (!this.jsonEnabled()) ux.action.stop('failed');
      this.warn(`Remote docs search unavailable, using local cache: ${(err as Error).message}`);
      return undefined;
    }
  }

  async run(): Promise<unknown> {
    const { query } = this.args;
    const { domain, remote } = this.flags;

    // Reject whitespace-only queries on every path (local, --domain, --remote).
    this.getSearchQueryTerms(query);

    if (domain && remote) {
      this.error(
        '--domain and --remote are mutually exclusive. Use one discovery mode at a time.',
        {
          exit: 2,
          code: 'CONFLICTING_FLAGS',
          suggestions: [
            `Local site API: ${this.config.bin} search "${query}" --domain ${domain}`,
            `Remote index: ${this.config.bin} search "${query}" --remote ${remote}`,
          ],
        }
      );
    }

    if (domain) {
      return this.executeSiteSearch(query, domain);
    }

    if (remote) {
      const remoteResults = await this.executeRemoteSearch(query, remote);
      if (remoteResults !== undefined) return remoteResults;
      // else: fall through to local cache search
    }

    this.validateSearchFlags();
    const queryTerms = this.getSearchQueryTerms(query);

    const roots = loadStoreRoots({
      configDir: this.config.configDir,
      cwd: process.cwd(),
      dataDir: this.config.dataDir,
    });
    const currentTime = new Date();

    const results = this.scanCacheDirForResults(roots.readRoots, queryTerms, currentTime);

    results.sort((a, b) => b.score - a.score);
    const finalResults = results.slice(0, this.flags.limit);

    // Under --json the human heading is suppressed, so surface truncation on stderr instead (warn
    // always emits, even in --json) without touching the stdout envelope. Human mode already shows
    // it in the heading, so only warn under --json.
    const notice = truncationNotice(results.length, finalResults.length, SEARCH_LABELS);
    if (notice && this.jsonEnabled()) this.warn(notice);

    this.logSearchResults(finalResults, results.length);

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

  // 1. Topic Match
  if (topic === term) {
    termScore += 100;
    termMatched = true;
  } else if (topic.includes(term)) {
    termScore += 60;
    termMatched = true;
  } else if (isFuzzyMatch(term, topic)) {
    termScore += 40;
    termMatched = true;
  }

  // 2. Tags Match
  if (tags.includes(term)) {
    termScore += 80;
    termMatched = true;
  } else if (tags.some((t) => isFuzzyMatch(term, t) || t.includes(term))) {
    termScore += 30;
    termMatched = true;
  }

  // 3. Source URL Match
  if (sourceUrl.includes(term) || sourceUrls.some((u) => u.includes(term))) {
    termScore += 50;
    termMatched = true;
  }

  // 4. Summary Term Frequency Match
  const summMatches = summ.split(term).length - 1;
  if (summMatches > 0) {
    termScore += 20 + Math.min(summMatches, 5) * 5;
    termMatched = true;
  }

  // 5. Compressed Content Term Frequency Match
  const compMatches = comp.split(term).length - 1;
  if (compMatches > 0) {
    termScore += 5 + Math.min(compMatches, 10) * 2;
    termMatched = true;
  }

  if (termMatched) {
    termScore += 10;
  }
  return termScore;
}

function isFuzzyMatch(term: string, target: string): boolean {
  if (term.length < 4 || target.length < 4) return false;
  return levenshtein(term, target) <= 2;
}
