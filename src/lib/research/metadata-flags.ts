/** Longest `--topic` value accepted; topics are short labels, not free text. */
export const MAX_TOPIC_LENGTH = 200;

/** Longest single `--tags` value accepted; tags are short taxonomic labels. */
export const MAX_TAG_LENGTH = 100;

/**
 * Reject a `--topic`/`--tags` value longer than its cap before it ever reaches the cache.
 * Unbounded input here would still round-trip through YAML frontmatter and `list`/`inspect`
 * output correctly, but a single unreasonably long value wraps a human-readable listing line
 * across dozens of terminal rows, so cap it at the flag boundary the same way `metadataNewlineError`
 * catches the newline case.
 *
 * @param flags - The command's parsed `topic`/`tags` flags.
 * @returns An error message naming the offending flag and its length cap, or `null` when both fit.
 */
export function metadataLengthError(flags: { topic?: string; tags?: string[] }): string | null {
  if (flags.topic !== undefined && flags.topic.length > MAX_TOPIC_LENGTH) {
    return `--topic must be ${MAX_TOPIC_LENGTH} characters or fewer (got ${flags.topic.length}).`;
  }
  const longTag = flags.tags?.find((tag) => tag.length > MAX_TAG_LENGTH);
  if (longTag !== undefined) {
    return `--tags must be ${MAX_TAG_LENGTH} characters or fewer (got ${longTag.length}).`;
  }
  return null;
}

/**
 * Reject a `--topic`/`--tags` value containing a line break before it ever reaches the cache.
 * Stored as-is, an embedded newline would corrupt the single-line-per-field frontmatter format
 * (see `sanitizeFrontmatterLine` in `artifact.ts`): at best a silently dropped stray line, at
 * worst a spoofed `key: value` pair or a bare `---` that closes the frontmatter fence early and
 * splices the rest of the metadata into the body. Failing fast here — rather than letting the
 * serializer silently rewrite the caller's input — gives the same actionable-error treatment as
 * every other flag validator (`durationFlagError`, etc.).
 *
 * @param flags - The command's parsed `topic`/`tags` flags.
 * @returns An error message naming the offending flag, or `null` when both are clean.
 */
export function metadataNewlineError(flags: { topic?: string; tags?: string[] }): string | null {
  if (flags.topic !== undefined && /[\r\n]/.test(flags.topic)) {
    return '--topic cannot contain line breaks.';
  }
  if (flags.tags?.some((tag) => /[\r\n]/.test(tag))) {
    return '--tags cannot contain line breaks.';
  }
  return null;
}
