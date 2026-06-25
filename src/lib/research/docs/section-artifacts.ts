import { createHash } from 'node:crypto';
import { join } from 'node:path';
import type { ResearchArtifact } from '../schema.js';
import type { SummaryLevel } from '../../config/schema.js';
import { buildCompressed } from '../compress.js';
import { estimateTokens } from '../token-estimate.js';
import { scanCacheDir, writeArtifact } from '../storage.js';
import { splitMarkdownSections } from './sections.js';

// Builds and persists section-level child artifacts for a long page (T-22). Children are keyed by
// sha256(parentKey#anchor) so the key stays hex (storage requires it), link back via
// parent_cache_key, and carry the parent's freshness policy. The page artifact is untouched and
// remains the provenance/revalidation anchor.

// Only split pages large enough to be awkward as one blob (~Node url.html territory).
const SECTION_TOKEN_THRESHOLD = 6000;

function childKey(parentKey: string, anchor: string): string {
  return createHash('sha256').update(`${parentKey}#${anchor}`).digest('hex');
}

/**
 * Derives section child artifacts from a parent page artifact. Returns [] when the page is short
 * or has too few headings to chunk.
 */
export function buildSectionArtifacts(
  parent: ResearchArtifact,
  currentTime: Date,
  summaryLevel: SummaryLevel
): ResearchArtifact[] {
  if (estimateTokens(parent.detailed) <= SECTION_TOKEN_THRESHOLD) return [];
  const sections = splitMarkdownSections(parent.detailed);
  const pm = parent.metadata;

  return sections.map((section) => {
    const key = childKey(pm.cache_key, section.anchor);
    const detailed = section.content;
    const compressed = buildCompressed(detailed, summaryLevel);
    return {
      metadata: {
        ...pm,
        artifact_type: 'section',
        source_url: `${pm.source_url}#${section.anchor}`,
        source_urls: [`${pm.source_url}#${section.anchor}`],
        cache_key: key,
        content_hash: createHash('sha256').update(detailed).digest('hex'),
        token_estimate: {
          compressed: estimateTokens(compressed),
          detailed: estimateTokens(detailed),
        },
        parent_cache_key: pm.cache_key,
        section_anchor: section.anchor,
        section_heading_path: section.headingPath,
      },
      summary: section.headingPath,
      compressed,
      detailed,
      provenance: `Section "${section.headingPath}" of ${pm.source_url} (parent ${pm.cache_key})`,
    };
  });
}

function activeChildrenOf(dataDir: string, parentKey: string): ResearchArtifact[] {
  return scanCacheDir(join(dataDir, 'research'), (artifact) =>
    artifact.metadata.parent_cache_key === parentKey && artifact.metadata.status === 'active'
      ? artifact
      : null
  );
}

/**
 * Regenerates a page's section artifacts: writes fresh children and archives any prior child whose
 * heading no longer exists, so a revalidated parent never leaves orphaned sections active. Returns
 * the number of active section children written.
 */
export function persistSectionArtifacts(
  dataDir: string,
  parent: ResearchArtifact,
  currentTime: Date,
  summaryLevel: SummaryLevel
): number {
  const children = buildSectionArtifacts(parent, currentTime, summaryLevel);
  const freshKeys = new Set(children.map((c) => c.metadata.cache_key));

  for (const orphan of activeChildrenOf(dataDir, parent.metadata.cache_key)) {
    if (!freshKeys.has(orphan.metadata.cache_key)) {
      orphan.metadata.status = 'archived';
      writeArtifact(dataDir, orphan.metadata.cache_key, orphan);
    }
  }
  for (const child of children) {
    writeArtifact(dataDir, child.metadata.cache_key, child);
  }
  return children.length;
}
