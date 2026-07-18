import { colors } from './color.js';

const HUMAN_LABEL_WIDTH = 25;

export const CLI_FLAG_DESCRIPTION_FRAGMENTS = {
  durationExamples: 'e.g. "2h", "7d", "6m"',
  freshnessTierPolicy: 'freshness tier policy',
  topic: 'topic',
  storageSecretScope: 'secrets always stored globally',
  taxonomicTags: 'taxonomic tags',
  filterTags: 'tags',
  repeatable: 'can be repeated',
} as const;

export const CLI_FLAG_DESCRIPTIONS = {
  freshnessTierPolicy: CLI_FLAG_DESCRIPTION_FRAGMENTS.freshnessTierPolicy,
  statusFreshnessTierPolicy: `${CLI_FLAG_DESCRIPTION_FRAGMENTS.freshnessTierPolicy} to evaluate; when omitted, uses the cached entry's own tier`,
  fetchTtl: `TTL duration for freshness (${CLI_FLAG_DESCRIPTION_FRAGMENTS.durationExamples})`,
  importTtl: `TTL duration for imported note freshness (${CLI_FLAG_DESCRIPTION_FRAGMENTS.durationExamples})`,
  statusTtl: `TTL duration to evaluate freshness (${CLI_FLAG_DESCRIPTION_FRAGMENTS.durationExamples})`,
  maxAge: `maximum cache age to accept (${CLI_FLAG_DESCRIPTION_FRAGMENTS.durationExamples})`,
  fetchStorage: `override where this result is cached (${CLI_FLAG_DESCRIPTION_FRAGMENTS.storageSecretScope})`,
  importStorage: `override where this note is cached (${CLI_FLAG_DESCRIPTION_FRAGMENTS.storageSecretScope})`,
  fetchTopic: `main research ${CLI_FLAG_DESCRIPTION_FRAGMENTS.topic} for metadata`,
  importTopic: `main ${CLI_FLAG_DESCRIPTION_FRAGMENTS.topic} for this research note`,
  filterTopic: `exact ${CLI_FLAG_DESCRIPTION_FRAGMENTS.topic} (case-insensitive)`,
  fetchTags: `${CLI_FLAG_DESCRIPTION_FRAGMENTS.taxonomicTags} for this research (${CLI_FLAG_DESCRIPTION_FRAGMENTS.repeatable})`,
  importTags: `${CLI_FLAG_DESCRIPTION_FRAGMENTS.taxonomicTags} (${CLI_FLAG_DESCRIPTION_FRAGMENTS.repeatable})`,
  filterTags: `${CLI_FLAG_DESCRIPTION_FRAGMENTS.filterTags} to require (must match all)`,
  format: 'output format',
  readOnly:
    '(alias: --plan) block filesystem writes/deletes; network fetches still run; also honored via BONSAI_READ_ONLY/BONSAI_PLAN_MODE',
  sourceUrlGlob: 'source URL glob (case-insensitive, supports * wildcard)',
  listArtifactType:
    'artifact type; section children are omitted from list - use inspect to see them',
  pruneArtifactType: 'artifact type to prune, including section children',
} as const;

export type HumanField = readonly [label: string, value: string];

export function formatHumanLabel(label: string): string {
  const text = `${label}:`;
  return colors.cyan(text.padEnd(Math.max(HUMAN_LABEL_WIDTH, text.length)));
}

export function formatHumanField(label: string, value: string): string {
  return `${formatHumanLabel(label)} ${value}`;
}

export function formatHumanFields(fields: readonly HumanField[]): string[] {
  return fields.map(([label, value]) => formatHumanField(label, value));
}
