import { describe, it, expect } from 'vitest';
import { normalizeArgv } from './argv.js';

describe('normalizeArgv', () => {
  const cases = [
    {
      name: 'bare --json should trigger early JSON error exit',
      input: ['--json'],
      expected: {
        argv: ['--json'],
        exitWithJson: {
          exitCode: 2,
          envelope: {
            schemaVersion: 1,
            command: 'bonsai',
            ok: false,
            exitCode: 2,
            stdout: '',
            stderr: 'Missing URL or command. Run bonsai --help for usage.',
            data: null,
          },
        },
      },
    },
    {
      name: 'leading --json with command should move --json to the end',
      input: ['--json', 'list'],
      expected: {
        argv: ['list', '--json'],
      },
    },
    {
      name: 'URL shorthand should prepend fetch command',
      input: ['https://example.com'],
      expected: {
        argv: ['fetch', 'https://example.com'],
      },
    },
    {
      name: 'URL shorthand should allow flags before the URL',
      input: ['--format', 'detailed', 'https://example.com'],
      expected: {
        argv: ['fetch', 'https://example.com', '--format', 'detailed'],
      },
    },
    {
      name: 'URL shorthand should allow repeated flags before the URL',
      input: ['--topic', 'Docs', '--tags', 'node', 'https://example.com'],
      expected: {
        argv: ['fetch', 'https://example.com', '--topic', 'Docs', '--tags', 'node'],
      },
    },
    {
      name: 'leading --json with URL shorthand should prepend fetch and move --json to the end',
      input: ['--json', 'https://example.com'],
      expected: {
        argv: ['fetch', 'https://example.com', '--json'],
      },
    },
    {
      name: 'leading --json with flags before URL shorthand should route fetch once',
      input: ['--json', '--format', 'detailed', 'https://example.com'],
      expected: {
        argv: ['fetch', 'https://example.com', '--format', 'detailed', '--json'],
      },
    },
    {
      name: 'ftp scheme-like URL shorthand should route to fetch for validation',
      input: ['ftp://example.com'],
      expected: {
        argv: ['fetch', 'ftp://example.com'],
      },
    },
    {
      name: 'scheme-only URLs like javascript: should route to fetch for protocol validation',
      input: ['javascript:alert(1)'],
      expected: {
        argv: ['fetch', 'javascript:alert(1)'],
      },
    },
    {
      name: 'data: URLs should route to fetch for protocol validation',
      input: ['data:text/html,hello'],
      expected: {
        argv: ['fetch', 'data:text/html,hello'],
      },
    },
    {
      name: 'help shorthand should move help to the end as --help',
      input: ['help', 'list'],
      expected: {
        argv: ['list', '--help'],
      },
    },
    {
      name: '-h should normalize to --help',
      input: ['-h'],
      expected: {
        argv: ['--help'],
      },
    },
    {
      name: 'command -h should normalize to command --help',
      input: ['list', '-h'],
      expected: {
        argv: ['list', '--help'],
      },
    },
    {
      name: '-h before subcommand should normalize to subcommand --help',
      input: ['-h', 'list'],
      expected: {
        argv: ['list', '--help'],
      },
    },
    {
      name: 'leading --json with -h should normalize help and dedupe json',
      input: ['--json', '-h'],
      expected: {
        argv: ['--help', '--json'],
      },
    },
    {
      name: '-h with trailing --json should normalize help and dedupe json',
      input: ['-h', '--json'],
      expected: {
        argv: ['--help', '--json'],
      },
    },
    {
      name: 'duplicate leading --json should dedupe and route the command',
      input: ['--json', '--json', 'list'],
      expected: {
        argv: ['list', '--json'],
      },
    },
    {
      name: 'duplicate trailing --json should dedupe',
      input: ['list', '--json', '--json'],
      expected: {
        argv: ['list', '--json'],
      },
    },
    {
      name: 'only duplicate --json flags should trigger early JSON usage exit',
      input: ['--json', '--json'],
      expected: {
        argv: ['--json'],
        exitWithJson: {
          exitCode: 2,
          envelope: {
            schemaVersion: 1,
            command: 'bonsai',
            ok: false,
            exitCode: 2,
            stdout: '',
            stderr: 'Missing URL or command. Run bonsai --help for usage.',
            data: null,
          },
        },
      },
    },
    {
      name: 'plain command should pass through unchanged',
      input: ['list'],
      expected: {
        argv: ['list'],
      },
    },
    {
      name: 'URL argument after a command should not become fetch shorthand',
      input: ['search', 'https://example.com'],
      expected: {
        argv: ['search', 'https://example.com'],
      },
    },
    {
      name: 'command with flags and URL argument should not become fetch shorthand',
      input: ['--topic', 'Docs', 'search', 'https://example.com'],
      expected: {
        argv: ['--topic', 'Docs', 'search', 'https://example.com'],
      },
    },
    {
      name: 'command with boolean flags and URL argument should not become fetch shorthand',
      input: ['--local', 'config', 'set', 'storage', 'https://example.com'],
      expected: {
        argv: ['--local', 'config', 'set', 'storage', 'https://example.com'],
      },
    },
    {
      name: 'input containing only flags should not trigger fetch shorthand',
      input: ['--topic', 'Docs'],
      expected: {
        argv: ['--topic', 'Docs'],
      },
    },
  ];

  for (const tc of cases) {
    it(tc.name, () => {
      const result = normalizeArgv(tc.input);
      expect(result.argv).toEqual(tc.expected.argv);
      if (tc.expected.exitWithJson) {
        expect(result.exitWithJson).toEqual(tc.expected.exitWithJson);
      } else {
        expect(result.exitWithJson).toBeUndefined();
      }
    });
  }
});
