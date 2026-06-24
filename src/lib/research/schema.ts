export interface TokenEstimate {
  compressed: number | null;
  detailed: number | null;
}

export interface ResearchArtifactMetadata {
  schema_version: number;
  artifact_type: 'source' | 'research_note';
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
  capture_method: 'static_fetch' | 'browser_fallback' | 'agent_supplied' | null;
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
}

export interface ResearchArtifact {
  metadata: ResearchArtifactMetadata;
  summary: string;
  compressed: string;
  detailed: string;
  provenance: string;
}
