/**
 * Compresses Markdown text by removing images, simplifying links from [text](url) to [text],
 * and collapsing multiple consecutive blank lines.
 */
export function compressMarkdown(markdown: string): string {
  if (!markdown) {
    return '';
  }
  let result = markdown;
  // Remove markdown images: ![alt](url) -> ""
  result = result.replace(/!\[.*?\]\(.*?\)/g, '');
  // Simplify links: [text](url) -> [text]
  result = result.replace(/\[(.*?)\]\(.*?\)/g, '[$1]');
  // Collapse multiple consecutive newlines (3 or more) to maximum 2 newlines
  result = result.replace(/\n{3,}/g, '\n\n');
  return result.trim();
}
