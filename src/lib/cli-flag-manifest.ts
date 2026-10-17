import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { valueTakingFlagTokensFromFlagMaps } from './value-flags.js';

type ManifestFlag = {
  type?: string;
  char?: string;
  aliases?: string[] | string;
  charAliases?: string[];
};

type OclifManifest = {
  commands: Record<string, { flags?: Record<string, ManifestFlag> }>;
};

// Startup reads the generated manifest instead of importing every command class. Importing the
// registry pulls the fetch stack (Readability, Turndown, the browser fallback) into --help.
function readOclifManifest(): OclifManifest {
  const manifestPath = join(dirname(fileURLToPath(import.meta.url)), '../../oclif.manifest.json');
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as OclifManifest;
}

const manifest = readOclifManifest();

/**
 * Every CLI token that consumes a following argv value, from the shipped oclif manifest.
 * Argv normalization stays off the command-class import graph.
 */
export const VALUE_TAKING_FLAG_TOKENS: ReadonlySet<string> = valueTakingFlagTokensFromFlagMaps(
  Object.values(manifest.commands).map((command) => command.flags)
);

/**
 * Root segment of every registered command id (`config:get` → `config`). oclif joins namespaced
 * command ids with `:` regardless of the display-only `topicSeparator` setting, so a token like
 * `config:get` is a real command, not a URL — argv normalization checks this set before assuming
 * `word:` is a URL scheme.
 */
export const KNOWN_COMMAND_ROOT_TOKENS: ReadonlySet<string> = new Set(
  Object.keys(manifest.commands).map((id) => id.split(':')[0]!)
);
