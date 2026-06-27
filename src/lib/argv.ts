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
export function normalizeArgv(rawArgv: string[]): NormalizationResult {
  if (rawArgv.length === 1 && rawArgv[0] === '--json') {
    return {
      argv: rawArgv,
      exitWithJson: {
        exitCode: 2,
        envelope: buildEnvelope({
          command: 'bonsai',
          ok: false,
          exitCode: 2,
          stderr: 'Missing URL or command. Run bonsai --help for usage.',
          data: null,
        }),
      },
    };
  }

  // oclif's JSON flag is command-scoped, so `bonsai list --json` works but
  // `bonsai --json list` is otherwise parsed as an unknown command named
  // "--json". Treat a leading --json as a global convenience and move it after
  // the command/URL before the rest of the shim routes shorthand URLs.
  const argvForRouting =
    rawArgv.length > 1 && rawArgv[0] === '--json' ? [...rawArgv.slice(1), '--json'] : rawArgv;

  const [firstArg, ...restArgv] = argvForRouting;
  // Treat any first arg that looks like a URL (carries a scheme) as the `fetch` shorthand.
  // Routing wrong-scheme URLs (ftp://, file://) here too means fetch can answer with a clear
  // "only http/https" error instead of oclif's cryptic "command not found".
  const looksLikeUrl = firstArg?.includes('://') ?? false;
  const normalizedArgv =
    firstArg === 'help'
      ? [...restArgv, '--help']
      : looksLikeUrl
        ? ['fetch', ...argvForRouting]
        : argvForRouting;

  return {
    argv: normalizedArgv,
  };
}
