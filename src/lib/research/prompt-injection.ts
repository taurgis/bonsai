import { Buffer } from 'node:buffer';

const REDACTION = '[Removed potentially unsafe agent instruction]';

const ZERO_WIDTH = /[\u200b-\u200f\ufeff]/g;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const BASE64_TOKEN = /(?<![A-Za-z0-9+/_-])(?:[A-Za-z0-9+/_-]{16,}={0,2})(?![A-Za-z0-9+/_-])/g;
const HEX_TOKEN = /(?<![a-f0-9])(?:0x)?[a-f0-9]{24,}(?![a-f0-9])/gi;
const QUOTED_SPAN = /(`[^`\n]+`|"[^"\n]+"|'[^'\n]+')/g;

const TYPOGLYCEMIA_TARGETS = [
  'ignore',
  'disregard',
  'forget',
  'override',
  'previous',
  'instructions',
  'instruction',
  'directions',
  'prompts',
  'system',
  'developer',
  'agent',
  'prompt',
  'message',
  'reveal',
  'print',
  'send',
  'secrets',
  'tokens',
  'credentials',
  'delete',
  'repository',
  'workspace',
];

const HARMFUL_INSTRUCTION_PATTERNS = [
  /(^|\b(?:please|assistant|system|user|agent)\s+)ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|directions?|prompts?)\b/i,
  /(^|\b(?:please|assistant|system|user|agent)\s+)disregard\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|directions?|prompts?)\b/i,
  /(^|\b(?:please|assistant|system|user|agent)\s+)forget\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|directions?|prompts?)\b/i,
  /(^|\b(?:please|assistant|system|user|agent)\s+)override\s+(the\s+)?(system|developer|agent)\s+(prompt|instructions?|message)\b/i,
  /(^|\b(?:please|assistant|system|user|agent)\s+)you\s+are\s+now\s+(in\s+)?(developer|admin|root|system)\s+mode\b/i,
  /(^|\b(?:please|assistant|system|user|agent)\s+)reveal\s+(your\s+)?(system|developer)\s+(prompt|instructions?|message)\b/i,
  /(^|\b(?:please|assistant|system|user|agent)\s+)print\s+(your\s+)?(system|developer)\s+(prompt|instructions?|message)\b/i,
  /(^|\b(?:please|assistant|system|user|agent)\s+)(exfiltrate|steal|leak)\s+(all\s+|the\s+|your\s+)?(secrets?|tokens?|api\s*keys?|credentials?|private\s+data)\b/i,
  /(^|\b(?:please|assistant|system|user|agent)\s+)send\s+(me\s+|all\s+|the\s+|your\s+)?(secrets?|tokens?|api\s*keys?|credentials?)\s+(to|over|via|using)\b/i,
  /(^|\b(?:please|assistant|system|user|agent)\s+)(upload|post|fetch|curl)\s+(all\s+|the\s+|your\s+)?(secrets?|tokens?|api\s*keys?|credentials?)\s+(to|over|via|using)\b/i,
  /(^|\b(?:please|assistant|system|user|agent)\s+)delete\s+(all\s+)?(files?|the\s+repository|the\s+workspace|the\s+home\s+directory)\b/i,
  /(^|\b(?:please|assistant|system|user|agent)\s+)run\s+.*\b(rm\s+-rf|curl\s+.*\|\s*(sh|bash)|sudo)\b/i,
];

function normalizeForDetection(text: string): string {
  return text
    .normalize('NFKC')
    .replace(ZERO_WIDTH, '')
    .replace(/[^\p{L}\p{N}\s|/.-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(normalizeTypoglycemia)
    .join(' ');
}

function normalizeTypoglycemia(word: string): string {
  const lower = word.toLowerCase();
  return TYPOGLYCEMIA_TARGETS.find((target) => isTypoglycemiaMatch(lower, target)) ?? word;
}

function isTypoglycemiaMatch(word: string, target: string): boolean {
  if (word.length !== target.length || word.length < 4) return false;
  if (word[0] !== target[0] || word.at(-1) !== target.at(-1)) return false;
  return sortLetters(word.slice(1, -1)) === sortLetters(target.slice(1, -1));
}

function sortLetters(value: string): string {
  return [...value].sort().join('');
}

function detectionCandidates(text: string): string[] {
  return [text, ...decodeBase64Tokens(text), ...decodeHexTokens(text)].map(normalizeForDetection);
}

function decodeBase64Tokens(text: string): string[] {
  return [...text.matchAll(BASE64_TOKEN)]
    .map((match) => decodeBase64(match[0]))
    .filter((decoded): decoded is string => Boolean(decoded));
}

function decodeBase64(token: string): string | null {
  try {
    const normalized = token.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(normalized, 'base64').toString('utf8');
    return isReadableDecodedText(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function decodeHexTokens(text: string): string[] {
  return [...text.matchAll(HEX_TOKEN)]
    .map((match) => decodeHex(match[0]))
    .filter((decoded): decoded is string => Boolean(decoded));
}

function decodeHex(token: string): string | null {
  const hex = token.startsWith('0x') ? token.slice(2) : token;
  if (hex.length % 2 !== 0) return null;

  try {
    const decoded = Buffer.from(hex, 'hex').toString('utf8');
    return isReadableDecodedText(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function isReadableDecodedText(text: string): boolean {
  if (!/[a-z]{3}/i.test(text)) return false;
  const printable = [...text].filter((char) => /[\t\n\r -~]/.test(char)).length;
  return printable / Math.max(text.length, 1) > 0.85;
}

function isUnsafeAgentInstruction(text: string): boolean {
  return detectionCandidates(text).some((candidate) =>
    HARMFUL_INSTRUCTION_PATTERNS.some((pattern) => pattern.test(candidate))
  );
}

function redactBlock(block: string): string {
  const withSafeSpans = redactUnsafeSpans(block);
  return isUnsafeAgentInstruction(withSafeSpans) ? REDACTION : withSafeSpans;
}

function redactUnsafeSpans(block: string): string {
  return block
    .replace(BASE64_TOKEN, (token) => redactTokenIfUnsafe(token, decodeBase64(token)))
    .replace(HEX_TOKEN, (token) => redactTokenIfUnsafe(token, decodeHex(token)))
    .replace(QUOTED_SPAN, (span) =>
      isUnsafeAgentInstruction(stripQuotes(span)) ? REDACTION : span
    );
}

function redactTokenIfUnsafe(token: string, decoded: string | null): string {
  return decoded && isUnsafeAgentInstruction(decoded) ? REDACTION : token;
}

function stripQuotes(span: string): string {
  if (span.startsWith('`') || span.startsWith('"') || span.startsWith("'")) {
    return span.slice(1, -1);
  }

  return span;
}

export function sanitizePromptInjection(markdown: string): string {
  return markdown
    .replace(HTML_COMMENT, (comment) => redactBlock(comment))
    .split(/(\n{2,})/)
    .map((block) => {
      if (/^\n+$/.test(block)) return block;

      const lineRedacted = block
        .split('\n')
        .map((line) => redactBlock(line))
        .join('\n');
      return lineRedacted === block ? redactBlock(block) : lineRedacted;
    })
    .join('');
}
