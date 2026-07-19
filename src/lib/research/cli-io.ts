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
}

/**
 * Single exit point for a URL that failed normalization, shared by BaseCommand and the command
 * services. A scheme-less but domain-shaped input reports MISSING_URL_SCHEME — the same code the
 * root `bonsai <url>` shorthand uses — so an agent sees one stable code for "forgot https://"
 * everywhere; truly unparseable input stays INVALID_URL.
 *
 * @param error - `this.error` (oclif) or `io.error`; must not return.
 */
export function failInvalidUrl(
  error: (msg: string, opts: CliErrorOptions) => never,
  url: string,
  message: string
): never {
  if (looksLikeSchemelessUrl(url)) {
    error(message, {
      exit: 2,
      code: 'MISSING_URL_SCHEME',
      suggestions: [`Use a full URL: https://${url}`],
    });
  }
  error(`Invalid URL: ${message}`, {
    exit: 2,
    code: 'INVALID_URL',
    suggestions: ['Provide a valid http:// or https:// URL.'],
  });
}
