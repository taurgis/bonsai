import TurndownService from 'turndown';

/**
 * Converts HTML content to clean, deterministic Markdown.
 * Configured to use ATX-style headings (#) and fenced code blocks (```).
 */
export function htmlToMarkdown(html: string): string {
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
  });

  return turndownService.turndown(html);
}
