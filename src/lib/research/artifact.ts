import type { ResearchArtifact, ResearchArtifactMetadata } from './schema.js';

function serializeArrayField(lines: string[], name: string, items: string[]): void {
  lines.push(`${name}:`);
  for (const item of items) {
    lines.push(`  - ${item}`);
  }
}

/**
 * Serializes artifact metadata to standard YAML frontmatter text.
 */
export function serializeMetadata(meta: ResearchArtifactMetadata): string {
  const lines: string[] = [];
  lines.push('---');
  lines.push(`schema_version: ${meta.schema_version}`);
  lines.push(`artifact_type: ${meta.artifact_type}`);
  lines.push(`source_url: ${meta.source_url || ''}`);

  serializeArrayField(lines, 'source_urls', meta.source_urls);

  lines.push(`normalized_url: ${meta.normalized_url}`);
  lines.push(`cache_key: ${meta.cache_key}`);
  lines.push(`topic: ${meta.topic || ''}`);

  serializeArrayField(lines, 'tags', meta.tags);
  serializeArrayField(lines, 'format_available', meta.format_available);

  lines.push(`tier: ${meta.tier}`);
  lines.push(`ttl: ${meta.ttl || ''}`);
  lines.push(`fetched_at: ${meta.fetched_at || ''}`);
  lines.push(`validated_at: ${meta.validated_at || ''}`);
  lines.push(`stale_after: ${meta.stale_after || ''}`);
  lines.push(`capture_method: ${meta.capture_method || ''}`);
  lines.push(`extraction_status: ${meta.extraction_status || ''}`);
  lines.push(`extraction_confidence: ${meta.extraction_confidence || ''}`);

  serializeArrayField(lines, 'quality_notes', meta.quality_notes);

  lines.push(`supplied_at: ${meta.supplied_at || ''}`);
  lines.push(`supplied_by: ${meta.supplied_by || ''}`);
  lines.push(`etag: ${meta.etag || ''}`);
  lines.push(`last_modified: ${meta.last_modified || ''}`);
  lines.push(`content_hash: ${meta.content_hash}`);

  lines.push('token_estimate:');
  lines.push(`  compressed: ${meta.token_estimate.compressed ?? ''}`);
  lines.push(`  detailed: ${meta.token_estimate.detailed ?? ''}`);

  lines.push(`status: ${meta.status}`);
  lines.push('---');

  return lines.join('\n');
}

/**
 * Serializes a full ResearchArtifact to a single Markdown string.
 */
export function serializeArtifact(artifact: ResearchArtifact): string {
  const meta = serializeMetadata(artifact.metadata);
  const sections: string[] = [
    meta,
    '## Summary',
    artifact.summary.trim(),
    '## Compressed',
    artifact.compressed.trim(),
    '## Detailed',
    artifact.detailed.trim(),
    '## Provenance',
    artifact.provenance.trim(),
  ];
  return sections.join('\n\n');
}

interface ParserState {
  meta: any;
  currentArrayKey: string | null;
  currentObjectKey: string | null;
}

function handleArrayItem(line: string, state: ParserState): boolean {
  if (line.startsWith('  - ')) {
    const val = line.slice(4).trim();
    if (state.currentArrayKey) {
      state.meta[state.currentArrayKey].push(val);
    }
    return true;
  }
  return false;
}

function handleNestedProp(line: string, state: ParserState): boolean {
  if (line.startsWith('  ')) {
    const trimmed = line.trim();
    const colIdx = trimmed.indexOf(':');
    if (colIdx !== -1 && state.currentObjectKey) {
      const k = trimmed.slice(0, colIdx).trim();
      const v = trimmed.slice(colIdx + 1).trim();
      const numVal = v === '' ? null : Number(v);
      state.meta[state.currentObjectKey][k] = isNaN(numVal as any) || v === '' ? null : numVal;
    }
    return true;
  }
  return false;
}

function initializeEmptyField(key: string, state: ParserState): void {
  const isArray = ['source_urls', 'tags', 'format_available', 'quality_notes'].includes(key);
  if (isArray) {
    state.currentArrayKey = key;
    state.meta[key] = [];
  } else if (key === 'token_estimate') {
    state.currentObjectKey = key;
    state.meta[key] = { compressed: null, detailed: null };
  } else {
    state.meta[key] = null;
  }
}

function handleRootProp(line: string, state: ParserState): void {
  const colIdx = line.indexOf(':');
  if (colIdx === -1) return;

  const key = line.slice(0, colIdx).trim();
  const val = line.slice(colIdx + 1).trim();

  state.currentArrayKey = null;
  state.currentObjectKey = null;

  if (val === '') {
    initializeEmptyField(key, state);
  } else {
    state.meta[key] = key === 'schema_version' ? Number(val) : val;
  }
}

/**
 * Parses lines of YAML frontmatter into a typed metadata object.
 */
export function parseMetadata(lines: string[]): ResearchArtifactMetadata {
  const state: ParserState = {
    meta: {
      schema_version: 1,
      artifact_type: 'source',
      source_url: '',
      source_urls: [],
      normalized_url: '',
      cache_key: '',
      topic: null,
      tags: [],
      format_available: [],
      tier: 'standard',
      ttl: null,
      fetched_at: null,
      validated_at: null,
      stale_after: null,
      capture_method: null,
      extraction_status: null,
      extraction_confidence: null,
      quality_notes: [],
      supplied_at: null,
      supplied_by: null,
      etag: null,
      last_modified: null,
      content_hash: '',
      token_estimate: { compressed: null, detailed: null },
      status: 'active',
    },
    currentArrayKey: null,
    currentObjectKey: null,
  };

  for (let line of lines) {
    line = line.trimEnd();
    if (!line) continue;

    if (handleArrayItem(line, state)) {
      continue;
    }
    if (handleNestedProp(line, state)) {
      continue;
    }
    handleRootProp(line, state);
  }

  return state.meta as ResearchArtifactMetadata;
}

/**
 * Extracts a named markdown section (e.g. ## Summary) from body text.
 */
export function extractSection(body: string, sectionName: string): string {
  const header = `## ${sectionName}`;
  const idx = body.indexOf(header);
  if (idx === -1) return '';

  const start = idx + header.length;
  const nextHeadingIdx = body.indexOf('\n## ', start);
  const rawText = nextHeadingIdx === -1 ? body.slice(start) : body.slice(start, nextHeadingIdx);
  return rawText.trim();
}

/**
 * Parses full Markdown content into a structured ResearchArtifact.
 */
export function parseArtifact(content: string): ResearchArtifact {
  const parts = content.split('\n');
  if (parts[0] !== '---') {
    throw new Error('Malformed artifact: Frontmatter missing starting boundary.');
  }
  const closingIdx = parts.indexOf('---', 1);
  if (closingIdx === -1) {
    throw new Error('Malformed artifact: Frontmatter missing ending boundary.');
  }

  const frontmatterLines = parts.slice(1, closingIdx);
  const bodyLines = parts.slice(closingIdx + 1);
  const bodyText = bodyLines.join('\n');

  const metadata = parseMetadata(frontmatterLines);
  const summary = extractSection(bodyText, 'Summary');
  const compressed = extractSection(bodyText, 'Compressed');
  const detailed = extractSection(bodyText, 'Detailed');
  const provenance = extractSection(bodyText, 'Provenance');

  return { metadata, summary, compressed, detailed, provenance };
}
