import { Args, Flags, ux } from '@oclif/core';
import { BaseCommand } from '../base-command.js';
import { enrichRowErrorEnvelope } from '../lib/envelope.js';
import {
  runFetchCommandService,
  validateFetchCommandFlags,
  type FetchCommandFlags,
} from '../lib/research/fetch-command-service.js';
import { CLI_FLAG_DESCRIPTIONS } from '../lib/cli-presentation.js';

export default class FetchCommand extends BaseCommand<typeof FetchCommand> {
  static id = 'fetch';
  static hidden = true;
  static summary = 'Fetch and cache URL research Markdown';
  static description =
    'Fetch a URL, convert the main content to Markdown, and cache compressed and detailed variants.\n\nUsually invoked as `bonsai <url>`; run `bonsai help fetch` for URL-form flags.';

  static examples = [
    {
      description: 'cache docs with detailed output, topic, tags, and TTL',
      command:
        '<%= config.bin %> https://docs.nestjs.com/ --topic "Backend Frameworks" --tags "Node" --tags "NestJS" --format detailed --ttl 7d',
    },
    {
      description: 'cache a volatile page with compressed JSON output',
      command:
        '<%= config.bin %> https://news.ycombinator.com/ --format compressed --ttl 2h --json',
    },
  ];

  static strict = false;

  static args = {
    url: Args.string({
      required: true,
      description: 'HTTP(S) URL to research',
    }),
  };

  static flags = {
    topic: Flags.string({
      char: 't',
      description: CLI_FLAG_DESCRIPTIONS.fetchTopic,
    }),
    tags: Flags.string({
      char: 'g',
      description: CLI_FLAG_DESCRIPTIONS.fetchTags,
      multiple: true,
    }),
    format: Flags.option({
      char: 'f',
      description: CLI_FLAG_DESCRIPTIONS.format,
      options: ['compressed', 'detailed'] as const,
      default: 'compressed',
    })(),
    tier: Flags.option({
      description: CLI_FLAG_DESCRIPTIONS.freshnessTierPolicy,
      options: ['stable', 'standard', 'volatile'] as const,
      default: 'standard',
    })(),
    ttl: Flags.string({
      char: 'l',
      description: CLI_FLAG_DESCRIPTIONS.fetchTtl,
    }),
    'max-age': Flags.string({
      description: CLI_FLAG_DESCRIPTIONS.maxAge,
    }),
    force: Flags.boolean({
      description: 'fetch fresh content, ignoring cached entries',
      default: false,
    }),
    'dry-run': Flags.boolean({
      description: 'fetch and validate without writing cache',
      default: false,
    }),
    'allow-stale': Flags.boolean({
      description: 'serve stale cache if revalidation fails',
      default: false,
    }),
    rendered: Flags.boolean({
      description: 'use browser-rendered capture for dynamic pages',
      default: false,
    }),
    storage: Flags.option({
      description: CLI_FLAG_DESCRIPTIONS.fetchStorage,
      options: ['global', 'project'] as const,
    })(),
  };

  static stdoutIsPrimaryData = true;

  /**
   * When a multi-URL batch has any per-URL failure, keep the result array (including hits) and
   * surface FETCH_FAILED on the envelope — same batch contract as status/inspect CACHE_MISS.
   */
  protected override toSuccessJson(data: unknown): Record<string, unknown> {
    return enrichRowErrorEnvelope(this.baseSuccessJson(data), data);
  }

  private serviceFlags(): FetchCommandFlags {
    return {
      topic: this.flags.topic,
      tags: this.flags.tags,
      format: this.flags.format,
      tier: this.flags.tier,
      ttl: this.flags.ttl,
      maxAge: this.flags['max-age'],
      force: this.flags.force,
      allowStale: this.flags['allow-stale'],
      rendered: this.flags.rendered,
      storage: this.flags.storage,
    };
  }

  async run(): Promise<unknown> {
    const io = this.cliIo();
    const flags = this.serviceFlags();
    validateFetchCommandFlags(io, flags);
    const dryRun = this.effectiveDryRun(this.flags['dry-run']);
    return runFetchCommandService({
      urls: this.parsedArgv,
      flags,
      dryRun,
      io,
      spinner: {
        running: () => Boolean(ux.action.running),
        start: (msg) => ux.action.start(msg),
        stop: (msg) => ux.action.stop(msg),
      },
    });
  }
}
