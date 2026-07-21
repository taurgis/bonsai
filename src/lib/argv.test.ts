import { describe, it, expect } from 'vitest';
import { normalizeArgv, positionalArgvTokens } from './argv.js';
import { VALUE_TAKING_FLAG_TOKENS, KNOWN_COMMAND_ROOT_TOKENS } from './cli-flag-manifest.js';

describe('normalizeArgv', () => {
  const cases = [
    {
      name: 'bare --json should trigger early JSON error exit',
      input: ['--json'],
      expected: {
        argv: ['--json'],
        earlyExit: {
          json: true,
          exitCode: 2,
          envelope: {
            schemaVersion: 1,
            command: 'bonsai',
            ok: false,
            exitCode: 2,
            stdout: '',
            stderr:
              'Missing URL or command. Run bonsai --help for usage.\n' +
              'Code: MISSING_COMMAND\n' +
              'Try this:\n' +
              '* Pass a URL: bonsai https://example.com\n' +
              '* Or a command: bonsai list',
            data: null,
            code: 'MISSING_COMMAND',
            suggestions: ['Pass a URL: bonsai https://example.com', 'Or a command: bonsai list'],
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
      name: 'URL shorthand should allow -l ttl short before the URL',
      input: ['-l', '2h', 'https://example.com'],
      expected: {
        argv: ['fetch', 'https://example.com', '-l', '2h'],
      },
    },
    {
      name: 'URL shorthand should allow -f format short before the URL',
      input: ['-f', 'detailed', 'https://example.com'],
      expected: {
        argv: ['fetch', 'https://example.com', '-f', 'detailed'],
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
        earlyExit: {
          json: true,
          exitCode: 2,
          envelope: {
            schemaVersion: 1,
            command: 'bonsai',
            ok: false,
            exitCode: 2,
            stdout: '',
            stderr:
              'Missing URL or command. Run bonsai --help for usage.\n' +
              'Code: MISSING_COMMAND\n' +
              'Try this:\n' +
              '* Pass a URL: bonsai https://example.com\n' +
              '* Or a command: bonsai list',
            data: null,
            code: 'MISSING_COMMAND',
            suggestions: ['Pass a URL: bonsai https://example.com', 'Or a command: bonsai list'],
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
      input: ['status', 'https://example.com'],
      expected: {
        argv: ['status', 'https://example.com'],
      },
    },
    {
      name: 'command with flags and URL argument should not become fetch shorthand',
      input: ['--topic', 'Docs', 'list'],
      expected: {
        argv: ['--topic', 'Docs', 'list'],
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
      name: 'input containing only flags early-exits as MISSING_COMMAND',
      input: ['--topic', 'Docs'],
      expected: {
        argv: [],
        earlyExit: {
          json: false,
          exitCode: 2,
          envelope: {
            schemaVersion: 1,
            command: 'bonsai',
            ok: false,
            exitCode: 2,
            stdout: '',
            stderr:
              'Missing URL or command. Run bonsai --help for usage.\n' +
              'Code: MISSING_COMMAND\n' +
              'Try this:\n' +
              '* Pass a URL: bonsai https://example.com\n' +
              '* Or a command: bonsai list',
            data: null,
            code: 'MISSING_COMMAND',
            suggestions: ['Pass a URL: bonsai https://example.com', 'Or a command: bonsai list'],
          },
        },
      },
    },
    {
      name: 'value flag that swallows a URL early-exits with a targeted tip',
      input: ['--tags', 'https://example.com/docs', '--json'],
      expected: {
        argv: ['--json'],
        earlyExit: {
          json: true,
          exitCode: 2,
          envelope: {
            schemaVersion: 1,
            command: 'bonsai',
            ok: false,
            exitCode: 2,
            stdout: '',
            stderr:
              'Missing URL or command. --tags consumed https://example.com/docs as its value, so there was no URL left to fetch.\n' +
              'Run bonsai --help for usage.\n' +
              'Code: MISSING_COMMAND\n' +
              'Try this:\n' +
              '* Pass the URL as the command (flags after): bonsai https://example.com/docs\n' +
              '* Or a named command: bonsai list',
            data: null,
            code: 'MISSING_COMMAND',
            suggestions: [
              'Pass the URL as the command (flags after): bonsai https://example.com/docs',
              'Or a named command: bonsai list',
            ],
          },
        },
      },
    },
    {
      name: 'leading --read-only before a command relocates after the command',
      input: ['--read-only', 'list'],
      expected: {
        argv: ['list', '--read-only'],
      },
    },
    {
      name: 'leading --plan before a command relocates after the command',
      input: ['--plan', 'list', '--json'],
      expected: {
        argv: ['list', '--plan', '--json'],
      },
    },
    {
      name: 'leading --plan before a URL relocates onto fetch',
      input: ['--plan', 'https://example.com'],
      expected: {
        argv: ['fetch', 'https://example.com', '--plan'],
      },
    },
    {
      name: 'lone --read-only triggers early human MISSING_COMMAND exit',
      input: ['--read-only'],
      expected: {
        argv: [],
        earlyExit: {
          json: false,
          exitCode: 2,
          envelope: {
            schemaVersion: 1,
            command: 'bonsai',
            ok: false,
            exitCode: 2,
            stdout: '',
            stderr:
              'Missing URL or command. Run bonsai --help for usage.\n' +
              'Code: MISSING_COMMAND\n' +
              'Try this:\n' +
              '* Pass a URL: bonsai https://example.com\n' +
              '* Or a command: bonsai list',
            data: null,
            code: 'MISSING_COMMAND',
            suggestions: ['Pass a URL: bonsai https://example.com', 'Or a command: bonsai list'],
          },
        },
      },
    },
    {
      name: 'lone --plan --json triggers early JSON MISSING_COMMAND exit',
      input: ['--plan', '--json'],
      expected: {
        argv: ['--json'],
        earlyExit: {
          json: true,
          exitCode: 2,
          envelope: {
            schemaVersion: 1,
            command: 'bonsai',
            ok: false,
            exitCode: 2,
            stdout: '',
            stderr:
              'Missing URL or command. Run bonsai --help for usage.\n' +
              'Code: MISSING_COMMAND\n' +
              'Try this:\n' +
              '* Pass a URL: bonsai https://example.com\n' +
              '* Or a command: bonsai list',
            data: null,
            code: 'MISSING_COMMAND',
            suggestions: ['Pass a URL: bonsai https://example.com', 'Or a command: bonsai list'],
          },
        },
      },
    },
    {
      name: '--version is a root meta action and must not early-exit',
      input: ['--version', '--json'],
      expected: {
        argv: ['--version', '--json'],
      },
    },
    {
      name: 'colon-namespaced command id (config:get) is a command, not a URL',
      input: ['config:get', 'storage'],
      expected: {
        argv: ['config:get', 'storage'],
      },
    },
    {
      name: 'colon-namespaced command with an unknown leaf still reaches command dispatch',
      input: ['config:frobnicate'],
      expected: {
        argv: ['config:frobnicate'],
      },
    },
    {
      name: 'colon typo on a top-level command still reaches command dispatch',
      input: ['list:extra'],
      expected: {
        argv: ['list:extra'],
      },
    },
    {
      name: 'unknown scheme-like prefix still routes to fetch for protocol validation',
      input: ['unknownscheme:thing'],
      expected: {
        argv: ['fetch', 'unknownscheme:thing'],
      },
    },
  ];

  for (const tc of cases) {
    it(tc.name, () => {
      const result = normalizeArgv(tc.input, {
        valueTakingFlags: VALUE_TAKING_FLAG_TOKENS,
        knownCommandRoots: KNOWN_COMMAND_ROOT_TOKENS,
      });
      expect(result.argv).toEqual(tc.expected.argv);
      if (tc.expected.earlyExit) {
        expect(result.earlyExit).toEqual(tc.expected.earlyExit);
      } else {
        expect(result.earlyExit).toBeUndefined();
      }
    });
  }

  it('treats every colon token as a URL when knownCommandRoots is empty', () => {
    // Documents the boundary: with no known roots configured, `looksLikeUrl` is the only signal,
    // matching the pre-fix behavior instead of silently guessing at command names.
    const result = normalizeArgv(['config:get'], {
      valueTakingFlags: VALUE_TAKING_FLAG_TOKENS,
      knownCommandRoots: new Set(),
    });
    expect(result.argv).toEqual(['fetch', 'config:get']);
  });
});

describe('VALUE_TAKING_FLAG_TOKENS', () => {
  it('is derived from command metadata (includes known value-taking flags)', () => {
    // Derived at module load from command classes — assert the contract agents rely on,
    // not a hand-maintained duplicate list.
    expect(VALUE_TAKING_FLAG_TOKENS.has('--topic')).toBe(true);
    expect(VALUE_TAKING_FLAG_TOKENS.has('-t')).toBe(true);
    expect(VALUE_TAKING_FLAG_TOKENS.has('--format')).toBe(true);
    expect(VALUE_TAKING_FLAG_TOKENS.has('--file')).toBe(true);
    expect(VALUE_TAKING_FLAG_TOKENS.has('-f')).toBe(true);
    expect(VALUE_TAKING_FLAG_TOKENS.has('--url')).toBe(true);
    expect(VALUE_TAKING_FLAG_TOKENS.has('--read-only')).toBe(false);
    expect(VALUE_TAKING_FLAG_TOKENS.has('--json')).toBe(false);
  });

  it('keeps value operands out of positional command tokens', () => {
    expect(
      positionalArgvTokens(
        ['fetch', 'https://example.com', '--format', 'detailed', '--topic', 'Docs', '--json'],
        VALUE_TAKING_FLAG_TOKENS
      )
    ).toEqual(['fetch', 'https://example.com']);
  });
});

describe('KNOWN_COMMAND_ROOT_TOKENS', () => {
  it('is derived from command metadata (top-level ids, not the namespaced leaves)', () => {
    expect(KNOWN_COMMAND_ROOT_TOKENS.has('config')).toBe(true);
    expect(KNOWN_COMMAND_ROOT_TOKENS.has('fetch')).toBe(true);
    expect(KNOWN_COMMAND_ROOT_TOKENS.has('list')).toBe(true);
    expect(KNOWN_COMMAND_ROOT_TOKENS.has('status')).toBe(true);
    expect(KNOWN_COMMAND_ROOT_TOKENS.has('javascript')).toBe(false);
    expect(KNOWN_COMMAND_ROOT_TOKENS.has('data')).toBe(false);
  });
});
