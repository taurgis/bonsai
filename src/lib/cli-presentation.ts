import { colors } from './color.js';

const HUMAN_LABEL_WIDTH = 25;

export const CLI_FLAG_DESCRIPTION_FRAGMENTS = {
  freshnessTierPolicy: 'freshness tier policy',
  topic: 'topic',
  ttlExample: 'e.g. "2h", "7d"',
  importTtlExample: 'e.g. "24h", "7d"',
  storageSecretScope: 'secrets always stored globally',
  taxonomicTags: 'taxonomic tags',
  filterTags: 'tags',
  repeatable: 'can be repeated',
} as const;

export const CLI_FLAG_DESCRIPTIONS = {
  freshnessTierPolicy: CLI_FLAG_DESCRIPTION_FRAGMENTS.freshnessTierPolicy,
  statusFreshnessTierPolicy:
    `${CLI_FLAG_DESCRIPTION_FRAGMENTS.freshnessTierPolicy} to evaluate against (default: the cached entry's own tier)`,
  fetchTtl: 'predicted lifespan: number + h/d/w/m/y (m = months), e.g. "2h", "7d", "6m"',
  importTtl: `predicted lifespan of the data (${CLI_FLAG_DESCRIPTION_FRAGMENTS.importTtlExample})`,
  statusTtl: `custom TTL duration to evaluate against (${CLI_FLAG_DESCRIPTION_FRAGMENTS.ttlExample})`,
  fetchStorage: `override where this result is cached (${CLI_FLAG_DESCRIPTION_FRAGMENTS.storageSecretScope})`,
  importStorage: `override where this note is cached (${CLI_FLAG_DESCRIPTION_FRAGMENTS.storageSecretScope})`,
  fetchTopic: `the main category/${CLI_FLAG_DESCRIPTION_FRAGMENTS.topic} of the research for metadata tagging`,
  importTopic: `the main ${CLI_FLAG_DESCRIPTION_FRAGMENTS.topic} for this research note`,
  filterTopic: `filter by exact ${CLI_FLAG_DESCRIPTION_FRAGMENTS.topic} (case-insensitive)`,
  fetchTags: `${CLI_FLAG_DESCRIPTION_FRAGMENTS.taxonomicTags} for this research (${CLI_FLAG_DESCRIPTION_FRAGMENTS.repeatable})`,
  importTags: `${CLI_FLAG_DESCRIPTION_FRAGMENTS.taxonomicTags} (${CLI_FLAG_DESCRIPTION_FRAGMENTS.repeatable})`,
  filterTags: `filter by ${CLI_FLAG_DESCRIPTION_FRAGMENTS.filterTags} (must match all tags specified)`,
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
