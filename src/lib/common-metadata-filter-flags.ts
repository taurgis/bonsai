import { Flags } from '@oclif/core';
import { CLI_FLAG_DESCRIPTIONS } from './cli-presentation.js';
import { CAPTURE_METHODS, PAGE_LEVEL_ARTIFACT_TYPES } from './research/schema.js';

/**
 * Metadata filter flags shared by `list` and `search` (topic/tags/url/freshness/artifact
 * type/capture method) — single source of truth so the two commands' flag definitions can never
 * drift apart. `artifactTypeDescription` is the one piece that differs: each command names itself
 * in its own `--artifact-type` help text (`list`/`search` currently, via `CLI_FLAG_DESCRIPTIONS`).
 */
export function commonMetadataFilterFlags(artifactTypeDescription: string) {
  return {
    topic: Flags.string({
      char: 't',
      description: CLI_FLAG_DESCRIPTIONS.filterTopic,
    }),
    tags: Flags.string({
      char: 'g',
      description: CLI_FLAG_DESCRIPTIONS.filterTags,
      multiple: true,
    }),
    url: Flags.string({
      description: CLI_FLAG_DESCRIPTIONS.sourceUrlGlob,
    }),
    freshness: Flags.option({
      description: 'freshness state',
      options: ['fresh', 'stale_grace', 'stale_expired'] as const,
    })(),
    'artifact-type': Flags.option({
      description: artifactTypeDescription,
      options: PAGE_LEVEL_ARTIFACT_TYPES,
    })(),
    'capture-method': Flags.option({
      description: 'capture method',
      options: CAPTURE_METHODS,
    })(),
  };
}
