/**
 * Shared validation for --url glob filters on list/prune.
 * Empty or whitespace-only values are almost always a shell-quoting mistake.
 */
export function emptyUrlFilterError(url: string | undefined): string | undefined {
  if (url === undefined) return undefined;
  if (url.trim() === '') {
    return '--url must be a non-empty glob pattern (e.g. "https://react.dev/*").';
  }
  return undefined;
}
