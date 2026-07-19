import { Args, Flags } from '@oclif/core';
import * as fs from 'node:fs';
import { BaseCommand } from '../base-command.js';
import {
  finishImportCommandService,
  prepareImportCommandService,
  type ImportCommandFlags,
  type ImportCommandArgs,
} from '../lib/research/import-command-service.js';
import { CLI_FLAG_DESCRIPTIONS } from '../lib/cli-presentation.js';

export default class ResearchImport extends BaseCommand<typeof ResearchImport> {
  static id = 'import';
  static summary = 'Import agent-supplied Markdown into cache';
  static description =
    'Store supplied Markdown under one URL or a multi-source research note, using the same freshness and storage metadata as fetched pages.';

  static examples = [
    {
      description: 'import detailed research for one URL from stdin',
      command:
        'printf "# My Article\\n" | <%= config.bin %> import https://example.com/docs --stdin --ttl 7d',
    },
    {
      description: 'import a research note synthesized from multiple source URLs',
      command:
        'echo "# Synthesized" | <%= config.bin %> import --stdin --topic "React docs" --source-url https://react.dev/a --source-url https://react.dev/b',
    },
    {
      description: 'import research from a Markdown file',
      command: '<%= config.bin %> import https://example.com/docs --file path/to/notes.md',
    },
    {
      description: 'import research from stdin with the file placeholder',
      command: 'cat notes.md | <%= config.bin %> import https://example.com/docs --file -',
    },
  ];

  static args = {
    url: Args.string({
      required: false,
      // oclif fills an omitted optional arg from piped stdin unless ignoreStdin is set. Without
      // this, the Markdown piped for `--stdin` is swallowed into `url`, making multi-source import
      // (`import --stdin --source-url ...`) wrongly look like it also got a positional URL.
      ignoreStdin: true,
      description: 'single source URL for single-source import',
    }),
  };

  static flags = {
    stdin: Flags.boolean({
      description: 'read Markdown from stdin',
      default: false,
    }),
    file: Flags.string({
      char: 'f',
      description: 'Markdown file to import, or "-" for stdin',
    }),
    'input-format': Flags.option({
      description: 'input content format',
      options: ['compressed', 'detailed'] as const,
      default: 'detailed',
    })(),
    topic: Flags.string({
      char: 't',
      description: CLI_FLAG_DESCRIPTIONS.importTopic,
    }),
    tags: Flags.string({
      char: 'g',
      description: CLI_FLAG_DESCRIPTIONS.importTags,
      multiple: true,
    }),
    tier: Flags.option({
      description: CLI_FLAG_DESCRIPTIONS.freshnessTierPolicy,
      options: ['stable', 'standard', 'volatile'] as const,
      default: 'standard',
    })(),
    'source-url': Flags.string({
      description: 'source URLs for multi-source import (can be repeated)',
      multiple: true,
    }),
    ttl: Flags.string({
      char: 'l',
      description: CLI_FLAG_DESCRIPTIONS.importTtl,
    }),
    'dry-run': Flags.boolean({
      description: 'validate import without writing cache',
      default: false,
    }),
    storage: Flags.option({
      description: CLI_FLAG_DESCRIPTIONS.importStorage,
      options: ['global', 'project'] as const,
    })(),
  };

  static stdoutIsPrimaryData = true;

  // Isolated so tests can force the interactive branch; `isTTY` is `true` only on a real terminal and
  // falsy (undefined) for pipes, files, and /dev/null. See https://nodejs.org/api/process.html#processstdin
  protected stdinIsInteractive(): boolean {
    return process.stdin.isTTY === true;
  }

  // The byte limit is owned by the import service (INPUT_LIMIT_BYTES) and always passed in.
  private async readStdin(limitBytes: number): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = '';
      let bytesRead = 0;
      process.stdin.setEncoding('utf8');

      const onData = (chunk: string) => {
        bytesRead += Buffer.byteLength(chunk, 'utf8');
        if (bytesRead > limitBytes) {
          process.stdin.removeListener('data', onData);
          reject(new Error('stdin size limit exceeded (max 1 MiB)'));
          return;
        }
        data += chunk;
      };

      process.stdin.on('data', onData);

      const onEnd = () => {
        process.stdin.removeListener('data', onData);
        resolve(data);
      };
      process.stdin.once('end', onEnd);

      process.stdin.once('error', (err) => {
        process.stdin.removeListener('data', onData);
        process.stdin.removeListener('end', onEnd);
        reject(err);
      });
    });
  }

  protected fsExistsSync(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  protected fsStatSync(filePath: string): fs.Stats {
    return fs.statSync(filePath);
  }

  protected fsReadFileSync(filePath: string): string {
    return fs.readFileSync(filePath, 'utf8');
  }

  private serviceArgs(): ImportCommandArgs {
    return { url: this.args.url };
  }

  private serviceFlags(): ImportCommandFlags {
    return {
      stdin: this.flags.stdin,
      file: this.flags.file,
      inputFormat: this.flags['input-format'],
      topic: this.flags.topic,
      tags: this.flags.tags,
      tier: this.flags.tier,
      sourceUrls: this.flags['source-url'] || [],
      ttl: this.flags.ttl,
      storage: this.flags.storage,
    };
  }

  async run(): Promise<unknown> {
    const args = this.serviceArgs();
    const flags = this.serviceFlags();
    const io = this.cliIo();
    const prepared = await prepareImportCommandService({
      args,
      flags,
      io,
      input: {
        stdinIsInteractive: () => this.stdinIsInteractive(),
        readStdin: (limitBytes) => this.readStdin(limitBytes),
        fsExistsSync: (filePath) => this.fsExistsSync(filePath),
        fsStatSync: (filePath) => this.fsStatSync(filePath),
        fsReadFileSync: (filePath) => this.fsReadFileSync(filePath),
      },
    });
    const dryRun = this.effectiveDryRun(this.flags['dry-run']);
    return finishImportCommandService(prepared, dryRun, io);
  }
}
