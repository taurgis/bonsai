/** Dry-run / write status vocabulary for JSON envelopes (not research-persist specific). */

export function importCacheWriteStatus(dryRun: boolean): 'would_import' | 'imported' {
  return dryRun ? 'would_import' : 'imported';
}

export function configWriteStatus(
  dryRun: boolean,
  action: 'set' | 'unset'
): 'would_set' | 'set' | 'would_unset' | 'unset' {
  if (action === 'set') return dryRun ? 'would_set' : 'set';
  return dryRun ? 'would_unset' : 'unset';
}

export function pruneWriteStatus(dryRun: boolean): 'would_prune' | 'pruned' {
  return dryRun ? 'would_prune' : 'pruned';
}
