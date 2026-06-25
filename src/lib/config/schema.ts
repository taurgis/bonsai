/**
 * Bonsai configuration schema. Mirrors oclif's layered config shape (user file,
 * project file, env, flag), scoped here to the single `storage` key that selects
 * where the research cache lives.
 */

export type StorageMode = 'global' | 'project';

// How aggressively the extractive summarizer condenses prose for the `compressed` format.
export type SummaryLevel = 'conservative' | 'balanced' | 'aggressive';

export interface ConfigValues {
  storage?: StorageMode;
  summary?: SummaryLevel;
}

export type ResolvedConfig = Required<ConfigValues>;
export type ConfigKey = keyof ConfigValues;

export const SCHEMA_VERSION = 1;

export const STORAGE_MODES: readonly StorageMode[] = ['global', 'project'];

export const SUMMARY_LEVELS: readonly SummaryLevel[] = ['conservative', 'balanced', 'aggressive'];

export const ALL_KEYS: readonly ConfigKey[] = ['storage', 'summary'];

export const BUILT_IN_DEFAULTS: ResolvedConfig = {
  // Default to global so existing installs keep using the OCLIF data dir unchanged.
  storage: 'global',
  // Default to the gentlest summarization so cached content keeps the most detail out of the box.
  summary: 'conservative',
};

export interface KeyMeta {
  description: string;
  /** Complete accepted set for enum keys — powers an actionable "Valid values: …" error. */
  values?: readonly string[];
  parseValue: (raw: string) => unknown;
  isValid: (value: unknown) => boolean;
  format: (value: unknown) => string;
}

export const KEY_META: Record<ConfigKey, KeyMeta> = {
  storage: {
    description: `Where research cache is stored (${STORAGE_MODES.join('|')}).`,
    values: STORAGE_MODES,
    parseValue: (raw) => raw.trim(),
    isValid: (v) => (STORAGE_MODES as readonly string[]).includes(String(v)),
    format: (v) => String(v),
  },
  summary: {
    description: `How aggressively the compressed format is summarized (${SUMMARY_LEVELS.join('|')}).`,
    values: SUMMARY_LEVELS,
    parseValue: (raw) => raw.trim(),
    isValid: (v) => (SUMMARY_LEVELS as readonly string[]).includes(String(v)),
    format: (v) => String(v),
  },
};

export function isKnownKey(key: string): key is ConfigKey {
  return (ALL_KEYS as readonly string[]).includes(key);
}

export function suggestKey(input: string): ConfigKey | undefined {
  const lower = input.toLowerCase();
  return ALL_KEYS.find((k) => k.toLowerCase().includes(lower) || lower.includes(k.toLowerCase()));
}

/** Comma-joined valid key list for error messages, kept in one place. */
export function validKeysHint(): string {
  return ALL_KEYS.join(', ');
}
