// Splits a long detailed-Markdown document into section chunks at H2/H3 boundaries (T-22), so a
// big API reference (e.g. Node `url.html`, ~17.5k tokens) becomes addressable section artifacts.
// Pure string work: no I/O, no artifact construction. H4+ headings stay within their parent chunk.

export interface SectionChunk {
  anchor: string;
  headingPath: string; // breadcrumb, e.g. "URL > The WHATWG URL API > Class: URL"
  level: number;
  content: string; // the heading line plus its body up to the next H2/H3
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

// GitHub-style anchor slug: lowercase, drop punctuation, spaces -> hyphens.
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

interface HeadingLine {
  index: number;
  level: number;
  text: string;
}

function findHeadings(lines: string[]): HeadingLine[] {
  const out: HeadingLine[] = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i]!)) inFence = !inFence;
    if (inFence) continue;
    const match = lines[i]!.match(HEADING_RE);
    if (match) out.push({ index: i, level: match[1]!.length, text: match[2]!.trim() });
  }
  return out;
}

// Builds the breadcrumb for a section from the nearest H1/H2 ancestors preceding it.
function breadcrumb(headings: HeadingLine[], current: number): string {
  const path: string[] = [];
  const currentLevel = headings[current]!.level;
  let needed = currentLevel - 1;
  for (let i = current - 1; i >= 0 && needed >= 1; i--) {
    if (headings[i]!.level === needed) {
      path.unshift(headings[i]!.text);
      needed--;
    }
  }
  path.push(headings[current]!.text);
  return path.join(' > ');
}

/**
 * Splits Markdown into H2/H3 section chunks. Returns an empty array when the document has fewer
 * than two such headings (nothing meaningful to chunk).
 */
export function splitMarkdownSections(markdown: string): SectionChunk[] {
  const lines = markdown.split('\n');
  const headings = findHeadings(lines);
  const chunkStarts = headings.filter((h) => h.level === 2 || h.level === 3);
  if (chunkStarts.length < 2) return [];

  const chunks: SectionChunk[] = [];
  for (let i = 0; i < chunkStarts.length; i++) {
    const start = chunkStarts[i]!;
    const end = chunkStarts[i + 1]?.index ?? lines.length;
    const content = lines.slice(start.index, end).join('\n').trim();
    const headingIdx = headings.indexOf(start);
    chunks.push({
      anchor: slugifyHeading(start.text),
      headingPath: breadcrumb(headings, headingIdx),
      level: start.level,
      content,
    });
  }
  return chunks;
}
