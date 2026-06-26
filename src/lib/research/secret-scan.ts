import type { ResearchArtifact } from './schema.js';

/**
 * Detect credentials in cache content so secret-bearing artifacts never land in a
 * project cache that may be committed to git. Each pattern carries only a human label
 * — the matched secret value is never returned, logged, or echoed.
 */
interface SecretPattern {
  label: string;
  re: RegExp;
}

const SECRET_PATTERNS: readonly SecretPattern[] = [
  { label: 'AWS access key id', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { label: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { label: 'GitHub fine-grained PAT', re: /\bgithub_pat_[A-Za-z0-9_]{80,}\b/ },
  { label: 'Slack token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
  { label: 'OpenAI/Anthropic-style API key', re: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { label: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  {
    label: 'JSON Web Token',
    re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
  },
  { label: 'Bearer token', re: /\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*/ },
  {
    label: 'Private key block',
    re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/,
  },
  {
    // Generic credential assignments with a non-trivial value: `api_key = "…"`, `secret: …`, and
    // UPPER_SNAKE env forms like `AWS_SECRET_ACCESS_KEY=…` / `DB_PASSWORD=…`. The keyword may be a
    // segment inside a longer identifier (so `_SECRET_` matches), which `\b…\b` boundaries missed.
    label: 'credential assignment',
    re: /(?:^|[^A-Za-z])(?:api[_-]?key|secret|token|password|passwd|client[_-]?secret|access[_-]?token)[A-Za-z0-9_-]*\s*[:=]\s*['"]?[A-Za-z0-9._\-/+]{16,}/i,
  },
];

/** Return the label of the first secret pattern found in `text`, or null if none match. */
export function detectSecret(text: string): string | null {
  for (const { label, re } of SECRET_PATTERNS) {
    if (re.test(text)) return label;
  }
  return null;
}

/** Scan every content field of an artifact. Returns the detected secret's label, or null. */
export function scanArtifactForSecret(artifact: ResearchArtifact): string | null {
  const haystack = [artifact.summary, artifact.compressed, artifact.detailed, artifact.provenance]
    .filter(Boolean)
    .join('\n');
  return detectSecret(haystack);
}
