import { emptyUrlFilterError } from './research/url.js';
import { durationFlagError } from './research/freshness.js';
import { emptyTopicFilterError, emptyTagsFilterError } from './research/metadata-filters.js';

/**
 * Pure prune-flag policy. Returns a usage/safety error descriptor, or null when flags are valid.
 * Kept outside the command class so the branching stays testable without oclif and so
 * `validatePruneFlags` stays a thin apply-error loop.
 */
export interface PruneFlagError {
  message: string;
  code:
    | 'INVALID_FLAG_VALUE'
    | 'MISSING_FILTER'
    | 'READ_ONLY_MODE'
    | 'CONFLICTING_FLAGS'
    | 'SAFETY_CHECK_REQUIRED'
    | 'INVALID_DURATION';
  suggestions?: string[];
}

/** Flag bag passed into {@link pruneFlagError}. */
export interface PruneFlagInput {
  olderThan?: string;
  inactive?: string;
  artifactType?: string;
  url?: string;
  topic?: string;
  tags?: string[];
  dryRun: boolean;
  yes: boolean;
  readOnly: boolean;
  bin: string;
}

function missingFilterError(input: PruneFlagInput): PruneFlagError | null {
  // Treat an explicitly passed empty string as "filter was attempted" so `--older-than ''`
  // is not misreported as MISSING_FILTER (durationError rejects it as INVALID_DURATION).
  // `tags` is the one array-valued flag here: oclif never parses a bare `--tags` into `[]` (a
  // multiple string flag requires a value per occurrence), so a non-empty array is the correct
  // "was this filter attempted" test, mirroring the `!== undefined` check used for every scalar flag.
  if (
    input.olderThan !== undefined ||
    input.inactive !== undefined ||
    input.artifactType !== undefined ||
    input.url !== undefined ||
    input.topic !== undefined ||
    (input.tags?.length ?? 0) > 0
  ) {
    return null;
  }
  return {
    message:
      'Must specify at least one pruning filter: --older-than, --inactive, --artifact-type, --url, --topic, or --tags.',
    code: 'MISSING_FILTER',
    suggestions: [`Preview age-based pruning: ${input.bin} prune --older-than 30d --dry-run`],
  };
}

/**
 * Mutation-gate checks. READ_ONLY before --dry-run/--yes conflict so
 * `--dry-run --yes --read-only` reports the more specific READ_ONLY_MODE code.
 */
function mutationSafetyError(input: PruneFlagInput): PruneFlagError | null {
  if (input.readOnly && input.yes) {
    return {
      message:
        '--yes cannot be used while read-only mode is active (--read-only/--plan or BONSAI_READ_ONLY/BONSAI_PLAN_MODE): mutations are disabled.',
      code: 'READ_ONLY_MODE',
      suggestions: [`Preview instead: ${input.bin} prune --dry-run`],
    };
  }
  if (input.dryRun && input.yes) {
    return {
      message:
        '--dry-run and --yes are mutually exclusive: --dry-run previews without deleting, --yes confirms deletion. Choose one.',
      code: 'CONFLICTING_FLAGS',
      suggestions: [
        `Preview without deleting: ${input.bin} prune --dry-run`,
        `Or confirm deletion: ${input.bin} prune --yes`,
      ],
    };
  }
  // Read-only mode implicitly previews, so the usual "pick one" safety check is redundant then.
  if (!input.readOnly && !input.dryRun && !input.yes) {
    const olderThanPart = input.olderThan ? ` --older-than ${input.olderThan}` : '';
    const urlPart = input.url ? ` --url "${input.url}"` : '';
    const topicPart = input.topic ? ` --topic "${input.topic}"` : '';
    const tagsPart = (input.tags ?? []).map((tag) => ` --tags "${tag}"`).join('');
    return {
      message:
        'Safety check: use --yes to confirm pruning, or --dry-run to preview files that would be deleted.',
      code: 'SAFETY_CHECK_REQUIRED',
      suggestions: [
        `Preview first: ${input.bin} prune --dry-run${olderThanPart}${urlPart}${topicPart}${tagsPart}`,
      ],
    };
  }
  return null;
}

function durationError(input: PruneFlagInput): PruneFlagError | null {
  for (const msg of [
    durationFlagError('--older-than', input.olderThan),
    durationFlagError('--inactive', input.inactive),
  ]) {
    if (msg) return { message: msg, code: 'INVALID_DURATION' };
  }
  return null;
}

/**
 * Return the first prune usage/safety error, or `null` when flags are valid.
 *
 * @param input - Parsed prune flags and binary name.
 * @returns Error descriptor for `this.error`, or `null`.
 */
export function pruneFlagError(input: PruneFlagInput): PruneFlagError | null {
  const flagValueErr =
    emptyUrlFilterError(input.url) ??
    emptyTopicFilterError(input.topic) ??
    emptyTagsFilterError(input.tags);
  if (flagValueErr) return { message: flagValueErr, code: 'INVALID_FLAG_VALUE' };

  // Duration before missing-filter so `--older-than ''` reports INVALID_DURATION, not MISSING_FILTER.
  return durationError(input) ?? missingFilterError(input) ?? mutationSafetyError(input);
}
