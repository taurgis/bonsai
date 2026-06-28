import { buildEnvelope } from './envelope.js';

export interface NormalizationResult {
  /** The normalized argv array to set on process.argv. */
  argv: string[];
  /** Optional metadata indicating the shim should exit early with a JSON envelope. */
  exitWithJson?: {
    exitCode: number;
    envelope: Record<string, unknown>;
  };
}

/**
 * Normalizes process.argv (excluding Node executable and script path) so the
 * oclif pipeline sees one consistent command structure.
 */
function missingUsageJsonExit(): NormalizationResult['exitWithJson'] {
  return {
    exitCode: 2,
    envelope: buildEnvelope({
      command: 'bonsai',
      ok: false,
      exitCode: 2,
      stderr: 'Missing URL or command. Run bonsai --help for usage.',
      data: null,
    }),
  };
}

const FLAGS_WITH_VALUES = new Set([
  '--topic',
  '-t',
  '--tags',
  '-g',
  '--format',
  '--tier',
  '--ttl',
  '--max-age',
  '--storage',
  '--file',
  '-f',
  '--input-format',
  '--source-url',
  '--freshness',
  '--artifact-type',
  '--capture-method',
  '--older-than',
  '--inactive',
  '--domain',
  '--remote',
  '--limit',
]);

export function normalizeArgv(rawArgv: string[]): NormalizationResult {
  const onlyJsonFlags = rawArgv.length > 0 && rawArgv.every((arg) => arg === '--json');
  if (onlyJsonFlags) {
    return {
      // bin/cli.mjs exits before applying argv when exitWithJson is set.
      argv: ['--json'],
      exitWithJson: missingUsageJsonExit(),
    };
  }

  // oclif's JSON flag is command-scoped, so `bonsai list --json` works but
  // `bonsai --json list` is otherwise parsed as an unknown command named
  // "--json". Collect every --json, append one copy after the command/URL, and
  // dedupe repeats like `bonsai --json --json list`.
  const jsonMode = rawArgv.includes('--json');
  let tokens = rawArgv.filter((arg) => arg !== '--json');

  // clig.dev: -h and --help must always work at any level.
  tokens = tokens.map((arg) => (arg === '-h' ? '--help' : arg));

  if (tokens[0] === 'help') {
    tokens = [...tokens.slice(1), '--help'];
  }

  const helpRequested = tokens.includes('--help');
  let core = tokens.filter((arg) => arg !== '--help');

  // Treat URL-shaped tokens as the `fetch` shorthand. Match both `https://...` and scheme-only
  // forms like `javascript:` or `data:` so fetch can reject unsupported protocols instead of oclif
  // reporting a misleading "command not found". If the invocation begins with a flag, allow common
  // flag-before-argument usage such as `bonsai --format detailed https://example.com`.
  let firstNonFlagArgIndex = -1;
  for (let i = 0; i < core.length; i++) {
    const token = core[i]!;
    if (token.startsWith('-')) {
      if (FLAGS_WITH_VALUES.has(token)) {
        i++; // skip the value
      }
      continue;
    }
    firstNonFlagArgIndex = i;
    break;
  }

  const rootFetchShape = firstNonFlagArgIndex !== -1 && looksLikeUrl(core[firstNonFlagArgIndex]!);
  if (rootFetchShape) {
    const url = core[firstNonFlagArgIndex]!;
    core = [
      'fetch',
      url,
      ...core.slice(0, firstNonFlagArgIndex),
      ...core.slice(firstNonFlagArgIndex + 1),
    ];
  }

  if (helpRequested) core.push('--help');
  if (jsonMode) core.push('--json');

  return { argv: core };
}

function looksLikeUrl(arg: string): boolean {
  return arg.includes('://') || /^[a-z][a-z0-9+.-]*:/i.test(arg);
}
