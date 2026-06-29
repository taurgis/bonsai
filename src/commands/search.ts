import { Args, Flags, ux } from '@oclif/core';
import { BaseCommand } from '../base-command.js';
import { loadSearchableArtifacts } from '../lib/research/search-index.js';
import {
  buildSearchCorpusStats,
  isEmptySearchQuery,
  parseSearchQuery,
  prepareSearchArtifact,
  scoreLocalSearch,
  toLocalSearchResult,
  type LocalSearchResult,
  type ParsedSearchQuery,
} from '../lib/research/local-search.js';
import type { ResearchArtifactMetadata } from '../lib/research/schema.js';
import {
  NO_TOPIC_LABEL,
  resultListHeading,
  truncationNotice,
  type ResultListLabels,
} from '../lib/text.js';
import { loadStoreRoots } from '../lib/research/store-roots.js';
import { evaluateFreshness } from '../lib/research/freshness.js';
import { ARTIFACT_TYPES } from '../lib/research/schema.js';
import { detectSite } from '../sites/index.js';
import { fetchStaticHtml, fetchText, postJson } from '../lib/research/fetcher.js';
import { normalizeUrl } from '../lib/research/url.js';
import {
  runRemoteDocsSearch,
  type RemoteSearchDeps,
} from '../lib/research/docs/remote-search-runner.js';
import { limitFlag } from '../lib/limit-flag.js';
import { colors, highlightQuery } from '../lib/color.js';

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
    limit: limitFlag(50, 10, 'maximum number of results to return (default 10, max 50)'),
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

  private parseQuery(raw: string): ParsedSearchQuery {
    const parsed = parseSearchQuery(raw);
    if (isEmptySearchQuery(parsed)) {
      this.error('Query string cannot be empty.', { exit: 2, code: 'EMPTY_QUERY' });
    }
    return parsed;
  }

  private matchesFilters(
    meta: ResearchArtifactMetadata,
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

  private scanCacheDirForResults(
    readRoots: string[],
    parsedQuery: ParsedSearchQuery,
    currentTime: Date
  ): { results: LocalSearchResult[]; activeCount: number } {
    const candidates: {
      prepared: ReturnType<typeof prepareSearchArtifact>;
      filePath: string;
      freshness: string;
    }[] = [];
    // Count active artifacts before filters so a "no results" message can tell an empty cache
    // ("populate it first") apart from a query that simply matched nothing ("broaden your search").
    let activeCount = 0;

    for (const { artifact, filePath } of loadSearchableArtifacts(readRoots)) {
      if (artifact.metadata.status !== 'active') continue;
      activeCount++;
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
      candidates.push({ prepared: prepareSearchArtifact(artifact), filePath, freshness });
    }

    const corpus = buildSearchCorpusStats(candidates.map((c) => c.prepared));
    const results: LocalSearchResult[] = [];

    for (const { prepared, filePath, freshness } of candidates) {
      const scored = scoreLocalSearch(prepared, parsedQuery, corpus, freshness);
      if (!scored) continue;
      results.push(toLocalSearchResult(filePath, prepared, freshness, scored));
    }

    return { results, activeCount };
  }

  private logSearchResults(
    finalResults: LocalSearchResult[],
    totalMatched: number,
    highlightTerms: string[],
    cacheIsEmpty: boolean
  ): void {
    if (this.jsonEnabled()) return;
    if (finalResults.length === 0) {
      this.log('No matching cached research entries found.');
      const tip = cacheIsEmpty
        ? `Tip: populate the cache first: ${colors.cyan(this.config.bin + ' <url>')}`
        : `Tip: broaden your search, or run ${colors.cyan(this.config.bin + ' list')} to see what is cached`;
      this.log(`\n${tip}`);
      return;
    }
    this.log(`${resultListHeading(totalMatched, finalResults.length, SEARCH_LABELS)}\n`);
    finalResults.forEach((res, index) => {
      const topicStr = res.topic ? colors.cyan(res.topic) : colors.gray(NO_TOPIC_LABEL);
      this.log(`${index + 1}. [${topicStr}] Score: ${colors.magenta(String(res.score))}`);
      this.log(`   Cache Key: ${colors.bold(res.cacheKey)}`);
      this.log(`   Snippet: ${highlightQuery(res.snippet, highlightTerms)}`);
      this.log(`   Source URLs: ${colors.gray(res.sourceUrls.join(', '))}\n`);
    });
  }

  // Prints a numbered result list to stdout for human (non-JSON) output. Shared by site and remote
  // search so the two paths can't drift in formatting.
  private printResults(
    heading: string,
    results: ReadonlyArray<{ title: string; url: string; snippet?: string }>,
    highlightTerms: string[]
  ): void {
    if (this.jsonEnabled()) return;
    this.log(colors.cyan(heading));
    results.forEach((r, i) => {
      this.log(`${i + 1}. ${colors.bold(r.title)}`);
      this.log(`   URL: ${colors.gray(r.url)}`);
      if (r.snippet) this.log(`   ${highlightQuery(r.snippet, highlightTerms)}`);
    });
  }

  // fallow-ignore-next-line complexity
  private async executeSiteSearch(
    query: string,
    domain: string,
    highlightTerms: string[]
  ): Promise<unknown> {
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
      this.printResults(
        `Found ${results.length} results from ${siteModule.name}:\n`,
        results,
        highlightTerms
      );
      return results.map((r) => ({ ...r, site_module_id: siteModule.id }));
    } catch (err) {
      if (!this.jsonEnabled()) ux.action.stop('failed');
      throw err;
    }
  }

  // Remote docs discovery. On any connector failure, degrade to local cache search with a warning
  // (T-20). Returns discovery results tagged remote: true so callers can tell them from cache hits.
  // fallow-ignore-next-line complexity
  private async executeRemoteSearch(
    query: string,
    docsUrl: string,
    highlightTerms: string[]
  ): Promise<unknown> {
    try {
      if (!this.jsonEnabled()) ux.action.start(`Searching ${docsUrl}`);
      const { provider, results } = await runRemoteDocsSearch(docsUrl, query, REMOTE_SEARCH_DEPS);
      if (!this.jsonEnabled()) ux.action.stop();
      this.printResults(
        `Found ${results.length} remote results via ${provider}:\n`,
        results,
        highlightTerms
      );
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

    const parsedQuery = this.parseQuery(query);

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
      return this.executeSiteSearch(query, domain, parsedQuery.highlightTerms);
    }

    if (remote) {
      let normalizedRemote: string;
      try {
        normalizedRemote = normalizeUrl(remote);
      } catch (err) {
        this.error(`Invalid --remote URL: ${(err as Error).message}`, {
          exit: 2,
          code: 'INVALID_URL',
        });
      }
      const remoteResults = await this.executeRemoteSearch(
        query,
        normalizedRemote,
        parsedQuery.highlightTerms
      );
      if (remoteResults !== undefined) return remoteResults;
      // else: fall through to local cache search (connector/network failure only)
    }

    const roots = loadStoreRoots({
      configDir: this.config.configDir,
      cwd: process.cwd(),
      dataDir: this.config.dataDir,
    });
    const currentTime = new Date();

    const { results, activeCount } = this.scanCacheDirForResults(
      roots.readRoots,
      parsedQuery,
      currentTime
    );

    results.sort((a, b) => b.score - a.score);
    const finalResults = results.slice(0, this.flags.limit);

    // Under --json the human heading is suppressed, so surface truncation on stderr instead (warn
    // always emits, even in --json) without touching the stdout envelope. Human mode already shows
    // it in the heading, so only warn under --json.
    const notice = truncationNotice(results.length, finalResults.length, SEARCH_LABELS);
    if (notice && this.jsonEnabled()) this.warn(notice);

    this.logSearchResults(
      finalResults,
      results.length,
      parsedQuery.highlightTerms,
      activeCount === 0
    );

    return finalResults;
  }
}
