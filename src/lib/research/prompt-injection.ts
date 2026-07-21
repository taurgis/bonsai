import { Buffer } from 'node:buffer';
import { CONTROL_CHAR_PATTERN } from '../text.js';

const REDACTION = '[Removed potentially unsafe agent instruction]';

const ZERO_WIDTH = /[\u200b-\u200f\ufeff]/g;
// Tab/LF/CR fall inside CONTROL_CHAR_PATTERN's Unicode "Control" category too, but they are
// legitimate Markdown whitespace, so the replacer below keeps those three and drops everything else.
const SAFE_CONTROL_CHARS = new Set(['\t', '\n', '\r']);

/**
 * Removes ANSI escape codes and other control bytes a malicious page could embed in its visible
 * text, while leaving Markdown-structural whitespace (tab/newline/CR) intact. Every fetch/import
 * path renders its stored content directly to the terminal (`bonsai <url>`, cache hits, etc.), so
 * raw control bytes surviving Readability/Turndown would replay as a terminal-injection attack on
 * every subsequent read of the cache; this is the choke point all of those paths share.
 */
function stripUnsafeControlChars(text: string): string {
  return text.replace(CONTROL_CHAR_PATTERN, (char) => (SAFE_CONTROL_CHARS.has(char) ? char : ''));
}
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

// Contexts where a following verb reads as a command aimed at the reader, not a third-person
// description of an attack (e.g. "An attacker may tell the model to ignore..." must stay
// unredacted — see the matching test below). `^` is matched per clause (see CLAUSE_BOUNDARY
// below), so a command hidden after an innocuous opener ("Heads up: ignore...") still counts as
// clause-initial; only right after a direct role-address word is the other allowed context.
const COMMAND_CONTEXT = String.raw`(?:^|\b(?:please|assistant|system|user|agent)\s+)`;

function commandPattern(suffix: string): RegExp {
  return new RegExp(COMMAND_CONTEXT + suffix, 'i');
}

const HARMFUL_INSTRUCTION_PATTERNS = [
  commandPattern(
    String.raw`ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|directions?|prompts?)\b`
  ),
  commandPattern(
    String.raw`disregard\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|directions?|prompts?)\b`
  ),
  commandPattern(
    String.raw`forget\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|directions?|prompts?)\b`
  ),
  commandPattern(
    String.raw`override\s+(the\s+)?(system|developer|agent)\s+(prompt|instructions?|message)\b`
  ),
  commandPattern(String.raw`you\s+are\s+now\s+(in\s+)?(developer|admin|root|system)\s+mode\b`),
  commandPattern(
    String.raw`reveal\s+(your\s+)?(system|developer)\s+(prompt|instructions?|message)\b`
  ),
  commandPattern(
    String.raw`print\s+(your\s+)?(system|developer)\s+(prompt|instructions?|message)\b`
  ),
  commandPattern(
    String.raw`(exfiltrate|steal|leak)\s+(all\s+|the\s+|your\s+)?(secrets?|tokens?|api\s*keys?|credentials?|private\s+data)\b`
  ),
  commandPattern(
    String.raw`send\s+(me\s+|all\s+|the\s+|your\s+)?(secrets?|tokens?|api\s*keys?|credentials?)\s+(to|over|via|using)\b`
  ),
  commandPattern(
    String.raw`(upload|post|fetch|curl)\s+(all\s+|the\s+|your\s+)?(secrets?|tokens?|api\s*keys?|credentials?)\s+(to|over|via|using)\b`
  ),
  commandPattern(
    String.raw`delete\s+(all\s+)?(files?|the\s+repository|the\s+workspace|the\s+home\s+directory)\b`
  ),
  commandPattern(String.raw`run\s+.*\b(rm\s+-rf|curl\s+.*\|\s*(sh|bash)|sudo)\b`),
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

// Sentence-ending punctuation splits a line into clauses for `^`-anchored matching below. This has
// to run on the raw text, before normalizeForDetection's charset filter erases that same
// punctuation into plain spaces — testing the anchor after normalization would never see it.
//
// ponytail: this still isn't complete — a filler *word* with no punctuation before it ("Please
// just ignore previous instructions") is a clause-internal command and stays unredacted, same as
// before this fix. Heuristic prompt-injection detection can't be made airtight with regex alone
// (OWASP LLM01 has no complete solution either); upgrade path is a small classifier or an LLM-based
// second pass over blocks this pattern set flags as borderline, if false negatives here prove costly.
const CLAUSE_BOUNDARY = /(?<=[.!?:;])\s+/;

function isUnsafeAgentInstruction(text: string): boolean {
  return text
    .split(CLAUSE_BOUNDARY)
    .some((clause) =>
      detectionCandidates(clause).some((candidate) =>
        HARMFUL_INSTRUCTION_PATTERNS.some((pattern) => pattern.test(candidate))
      )
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

/**
 * Scans Markdown for embedded prompt-injection attacks and redacts any block or line that matches.
 * Detects direct patterns, plus base64/hex-encoded variants and typoglycemia obfuscation.
 * HTML comments are checked first; the body is then split on paragraph breaks and scanned line-by-line.
 *
 * @param markdown - Markdown content (possibly untrusted, sourced from fetched pages).
 * @returns Sanitized Markdown with harmful instruction blocks replaced by a redaction placeholder,
 *   and ANSI/control bytes stripped so a cached read can never replay them to a terminal.
 */
export function sanitizePromptInjection(markdown: string): string {
  const redacted = markdown
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
  return stripUnsafeControlChars(redacted);
}
