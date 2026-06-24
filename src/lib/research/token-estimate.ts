/**
 * Estimates the token count of a given text string.
 * Uses the simple rule-of-thumb formula: ceil(character_count / 4).
 */
export function estimateTokens(text: string): number {
  return Math.ceil((text || '').length / 4);
}
