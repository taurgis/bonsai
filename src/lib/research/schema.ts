export interface TokenEstimate {
  compressed: number | null;
  detailed: number | null;
}

export type CaptureMethod =
  | 'static_fetch'
  | 'browser_fallback'
  | 'agent_supplied'
  | 'route_markdown'
  | 'github_source';

export interface ResearchArtifactMetadata {
  schema_version: number;
  // `index` = navigation/hub or llms.txt site index; `section` = a heading-level child of a page.
  artifact_type: 'source' | 'research_note' | 'index' | 'section';
  source_url: string;
  source_urls: string[];
  normalized_url: string;
  cache_key: string;
  topic: string | null;
  tags: string[];
  format_available: string[];
  tier: 'stable' | 'standard' | 'volatile';
  ttl: string | null;
  fetched_at: string | null;
  validated_at: string | null;
  stale_after: string | null;
  capture_method: CaptureMethod | null;
  extraction_status: 'extracted' | 'agent_supplied' | 'failed' | null;
  extraction_confidence: 'high' | 'medium' | 'low' | null;
  quality_notes: string[];
  supplied_at: string | null;
  supplied_by: string | null;
  etag: string | null;
  last_modified: string | null;
  content_hash: string;
  token_estimate: TokenEstimate;
  status: 'active' | 'archived';
  site_module_id: string | null;
  // Phase 2 docs-engine capability provenance. Null when the page is not a recognized docs page.
  docs_engine: string | null;
  docs_framework: string | null;
  // URL of the machine-readable/source artifact the detailed content was captured from, when it
  // was not the page HTML (route `.md`, llms.txt, or raw GitHub source).
  source_doc_url: string | null;
  search_provider: string | null;
  // Section-artifact linkage (artifact_type === 'section'); null on page-level artifacts.
  parent_cache_key: string | null;
  section_anchor: string | null;
  section_heading_path: string | null;
}

export interface ResearchArtifact {
  metadata: ResearchArtifactMetadata;
  summary: string;
  compressed: string;
  detailed: string;
  provenance: string;
}
