import { EXIT_USAGE } from './cli-error-policy.js';
import { buildCliErrorEnvelope } from './envelope.js';

/** Result of argv normalization before oclif command dispatch. */
export interface NormalizationResult {
  /** The normalized argv array to set on process.argv. */
  argv: string[];
  /**
   * Exit before oclif runs. Used for flag-only / bare `--json` usage errors so human and JSON
   * callers share one path (no "leave a flag token for command_not_found" hack).
   */
  earlyExit?: {
    exitCode: number;
    envelope: Record<string, unknown>;
    json: boolean;
  };
}

/** Options for {@link normalizeArgv}. */
export interface ArgvNormalizeOptions {
  /** Tokens that consume the next argv value (`--topic`, `-t`, …). From cli-flag-manifest. */
  valueTakingFlags: ReadonlySet<string>;
  /**
   * Root segment of every registered command id (`config:get` → `config`). From cli-flag-manifest.
   * A `word:` token whose root is in this set is a command (`config:get`), never a URL scheme.
   */
  knownCommandRoots: ReadonlySet<string>;
}

/** Shared MISSING_COMMAND copy for flag-only argv preflight. */
function missingCommandDetails(
  bin: string,
  swallowed?: { flag: string; url: string } | null
): { message: string; code: 'MISSING_COMMAND'; suggestions: string[] } {
  if (swallowed) {
    return {
      code: 'MISSING_COMMAND',
      message: [
        `Missing URL or command. ${swallowed.flag} consumed ${swallowed.url} as its value, so there was no URL left to fetch.`,
        `Run ${bin} --help for usage.`,
      ].join('\n'),
      suggestions: [
        `Pass the URL as the command (flags after): ${bin} ${swallowed.url}`,
        `Or a named command: ${bin} list`,
      ],
    };
  }
  return {
    code: 'MISSING_COMMAND',
    message: `Missing URL or command. Run ${bin} --help for usage.`,
    suggestions: [`Pass a URL: ${bin} https://example.com`, `Or a command: ${bin} list`],
  };
}

/**
 * Boolean flags registered on every command via BaseCommand.baseFlags. oclif only merges those after
 * it picks a command, so `bonsai --read-only list` would otherwise treat `--read-only` as the
 * command id. Strip and re-append them after the command/URL, same pattern as `--json`.
 */
const GLOBAL_BOOLEAN_FLAGS = new Set(['--read-only', '--plan']);

/**
 * When a value-taking flag is the only "command" and its value looks like a URL, the user almost
 * certainly put the URL where the flag value belongs (e.g. `bonsai --tags https://example.com`).
 */
function findSwallowedUrlFlag(
  argv: readonly string[] | undefined,
  valueTakingFlags: ReadonlySet<string>
): { flag: string; url: string } | null {
  if (!argv?.length) return null;
  for (let i = 0; i < argv.length - 1; i++) {
    const flag = argv[i]!;
    if (!valueTakingFlags.has(flag)) continue;
    const value = argv[i + 1]!;
    if (value.startsWith('-')) continue;
    if (looksLikeUrl(value)) return { flag, url: value };
  }
  return null;
}

function missingUsageExit(
  json: boolean,
  argv: readonly string[],
  valueTakingFlags: ReadonlySet<string>
): NonNullable<NormalizationResult['earlyExit']> {
  const details = missingCommandDetails('bonsai', findSwallowedUrlFlag(argv, valueTakingFlags));
  return {
    exitCode: EXIT_USAGE,
    json,
    envelope: buildCliErrorEnvelope({
      command: 'bonsai',
      message: details.message,
      code: details.code,
      suggestions: details.suggestions,
    }),
  };
}

/**
 * Index of the first positional command/URL token, skipping flags (and value-flag operands)
 * plus root meta tokens that never name a command (`--help`, `--json`, globals).
 */
function firstPositionalIndex(
  argv: readonly string[],
  valueTakingFlags: ReadonlySet<string>
): number {
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (token === '--help' || token === '--json' || GLOBAL_BOOLEAN_FLAGS.has(token)) continue;
    if (token.startsWith('-')) {
      if (valueTakingFlags.has(token)) i++;
      continue;
    }
    return i;
  }
  return -1;
}

/** True when argv selects a command, URL, or root `--version` action (not flag-only usage). */
function hasCommandToken(argv: readonly string[], valueTakingFlags: ReadonlySet<string>): boolean {
  return argv.includes('--version') || firstPositionalIndex(argv, valueTakingFlags) !== -1;
}

/**
 * Normalize raw process argv for oclif. `valueTakingFlags` must come from the composition root
 * (`cli-flag-manifest`) — this module stays free of command registry imports.
 */
export function normalizeArgv(
  rawArgv: string[],
  options: ArgvNormalizeOptions
): NormalizationResult {
  const { valueTakingFlags, knownCommandRoots } = options;
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
  // Exclude tokens whose part before the first `:` names a real command (`config:get`) — oclif
  // joins namespaced command ids with `:` regardless of the display-only topicSeparator, so those
  // are commands, not URL schemes, and must reach normal command dispatch instead of a misleading
  // "Invalid URL" error.
  const firstNonFlagArgIndex = firstPositionalIndex(core, valueTakingFlags);
  const firstArg = firstNonFlagArgIndex !== -1 ? core[firstNonFlagArgIndex]! : undefined;
  const rootFetchShape =
    firstArg !== undefined &&
    looksLikeUrl(firstArg) &&
    !knownCommandRoots.has(firstArg.split(':')[0]!);
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

  // Flag-only argv (`--json`, `--read-only`, `--tags https://…`) never resolves a command.
  // Exit here so command_not_found does not special-case dash-prefixed ids.
  // Empty argv and `--help`/`--version` stay with oclif.
  if (!helpRequested && core.length > 0 && !hasCommandToken(core, valueTakingFlags)) {
    return {
      argv: jsonMode ? ['--json'] : [],
      earlyExit: missingUsageExit(jsonMode, rawArgv, valueTakingFlags),
    };
  }

  return { argv: core };
}

/**
 * Non-flag positional tokens from a (typically already-normalized) argv. Skips `--help`/`--json`
 * and any dash-prefixed flags so multi-segment command ids (`config get`) stay intact. Shared by
 * help-preflight and json-meta — both run after `normalizeArgv` has already folded `help X` →
 * `X --help` and `-h` → `--help`.
 */
export function positionalArgvTokens(
  argv: readonly string[],
  valueTakingFlags: ReadonlySet<string>
): string[] {
  const tokens: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--') break;
    if (arg === '--help' || arg === '--json') continue;
    if (arg.startsWith('-')) {
      if (!arg.includes('=') && valueTakingFlags.has(arg)) i++;
      continue;
    }
    tokens.push(arg);
  }
  return tokens;
}

function looksLikeUrl(arg: string): boolean {
  return arg.includes('://') || /^[a-z][a-z0-9+.-]*:/i.test(arg);
}
