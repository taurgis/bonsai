import { buildCliErrorEnvelope, missingCommandDetails } from './envelope.js';

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
  const details = missingCommandDetails('bonsai');
  return {
    exitCode: 2,
    envelope: buildCliErrorEnvelope({
      command: 'bonsai',
      message: details.message,
      code: details.code,
      suggestions: details.suggestions,
    }),
  };
}

/** Flags that consume the next argv token as a value. Keep short aliases in sync with command chars. */
export const FLAGS_WITH_VALUES = new Set([
  '--topic',
  '-t',
  '--tags',
  '-g',
  '--format',
  '--tier',
  '--ttl',
  '-l',
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
  '--limit',
  '--url',
]);

/**
 * Boolean flags registered on every command via BaseCommand.baseFlags. oclif only merges those after
 * it picks a command, so `bonsai --read-only list` would otherwise treat `--read-only` as the
 * command id. Strip and re-append them after the command/URL, same pattern as `--json`.
 */
export const GLOBAL_BOOLEAN_FLAGS = new Set(['--read-only', '--plan']);

/**
 * When a value-taking flag is the only "command" and its value looks like a URL, the user almost
 * certainly put the URL where the flag value belongs (e.g. `bonsai --tags https://example.com`).
 */
export function findSwallowedUrlFlag(
  argv: readonly string[] | undefined
): { flag: string; url: string } | null {
  if (!argv?.length) return null;
  for (let i = 0; i < argv.length - 1; i++) {
    const flag = argv[i]!;
    if (!FLAGS_WITH_VALUES.has(flag)) continue;
    const value = argv[i + 1]!;
    if (value.startsWith('-')) continue;
    if (looksLikeUrl(value)) return { flag, url: value };
  }
  return null;
}

export function normalizeArgv(rawArgv: string[]): NormalizationResult {
  const onlyUsageFlags =
    rawArgv.length > 0 && rawArgv.every((arg) => arg === '--json' || GLOBAL_BOOLEAN_FLAGS.has(arg));
  if (onlyUsageFlags) {
    // JSON callers get the envelope immediately. Human flag-only argv keeps a flag token so the
    // command_not_found hook can emit MISSING_COMMAND (same wording as bare --json).
    if (rawArgv.includes('--json')) {
      return {
        argv: ['--json'],
        exitWithJson: missingUsageJsonExit(),
      };
    }
    return { argv: [rawArgv.find((arg) => GLOBAL_BOOLEAN_FLAGS.has(arg))!] };
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

  // Relocate base boolean flags so they survive command resolution (see GLOBAL_BOOLEAN_FLAGS).
  const relocatedGlobals: string[] = [];
  core = core.filter((arg) => {
    if (!GLOBAL_BOOLEAN_FLAGS.has(arg)) return true;
    if (!relocatedGlobals.includes(arg)) relocatedGlobals.push(arg);
    return false;
  });

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
  core.push(...relocatedGlobals);
  if (jsonMode) core.push('--json');

  return { argv: core };
}

/**
 * Non-flag positional tokens from a (typically already-normalized) argv. Skips `--help`/`--json`
 * and any dash-prefixed flags so multi-segment command ids (`config get`) stay intact. Shared by
 * help-preflight and json-meta — both run after `normalizeArgv` has already folded `help X` →
 * `X --help` and `-h` → `--help`.
 */
export function positionalArgvTokens(argv: readonly string[]): string[] {
  const tokens: string[] = [];
  for (const arg of argv) {
    if (arg === '--') break;
    if (arg === '--help' || arg === '--json') continue;
    if (arg.startsWith('-')) continue;
    tokens.push(arg);
  }
  return tokens;
}

function looksLikeUrl(arg: string): boolean {
  return arg.includes('://') || /^[a-z][a-z0-9+.-]*:/i.test(arg);
}
