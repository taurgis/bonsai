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
