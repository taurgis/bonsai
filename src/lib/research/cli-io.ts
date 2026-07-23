import { EXIT_USAGE } from '../cli-error-policy.js';
import { looksLikeSchemelessUrl } from './url.js';

/** Options accepted by {@link CliIo.error} — the subset of oclif's `this.error` options Bonsai uses. */
export interface CliErrorOptions {
  exit: number;
  code?: string;
  suggestions?: string[];
  ref?: string;
}

/**
 * Narrow command-context port passed from oclif commands into command services, so the services
 * stay free of oclif imports and are testable without a framework harness.
 */
export interface CliIo {
  bin: string;
  configDir: string | undefined;
  dataDir: string;
  cwd: string;
  json: boolean;
  warn(msg: string): void;
  log(msg: string): void;
  error(msg: string, opts: CliErrorOptions): never;
  /**
   * Print one row of a batch failure with the same "Error: … / Code: … / Try this: …" rendering as
   * {@link error}, but without exiting the process — a batch (`fetch url1 url2`) must keep
   * processing the remaining rows after one fails. Using `warn` for this mislabels a real failure
   * as non-fatal even though the row still flips the command's exit code and JSON `ok` to false.
   */
  errorRow(msg: string, opts: Omit<CliErrorOptions, 'exit'>): void;
}

/**
 * Single exit point for a URL that failed normalization, shared by BaseCommand and the command
 * services. A scheme-less but domain-shaped input reports MISSING_URL_SCHEME — the same code the
 * root `bonsai <url>` shorthand uses — so an agent sees one stable code for "forgot https://"
 * everywhere; truly unparseable input stays INVALID_URL.
 *
 * @param error - `this.error` (oclif) or `io.error`; must not return.
 * @param url - Raw URL string the user supplied.
 * @param message - Human-readable failure message.
 * @returns Never — always exits via `error`.
 */
export function failInvalidUrl(
  error: (msg: string, opts: CliErrorOptions) => never,
  url: string,
  message: string
): never {
  if (looksLikeSchemelessUrl(url)) {
    error(message, {
      exit: EXIT_USAGE,
      code: 'MISSING_URL_SCHEME',
      suggestions: [`Use a full URL: https://${url}`],
    });
  }
  error(`Invalid URL: ${message}`, {
    exit: EXIT_USAGE,
    code: 'INVALID_URL',
    suggestions: ['Provide a valid http:// or https:// URL.'],
  });
}
