import TurndownService from 'turndown';

// Cell text must survive as a single Markdown table cell: collapse internal whitespace (newlines
// from block children would split the row) and escape pipes (an unescaped `|` adds phantom columns).
function tableCellText(node: Node): string {
  return (node.textContent || '').replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|');
}

function rowCells(tr: Element): string[] {
  return Array.from(tr.children).map(tableCellText);
}

// A table's own rows are direct <tr> children or rows inside its direct <thead>/<tbody>/<tfoot>.
// Walking the structure (rather than querySelectorAll('tr')) excludes rows of tables nested inside
// a cell, which would otherwise be absorbed as phantom rows of the outer table.
function ownRows(table: Element): Element[] {
  const rows: Element[] = [];
  for (const child of Array.from(table.children)) {
    const tag = child.tagName.toLowerCase();
    if (tag === 'tr') rows.push(child);
    else if (tag === 'thead' || tag === 'tbody' || tag === 'tfoot') {
      for (const row of Array.from(child.children)) {
        if (row.tagName.toLowerCase() === 'tr') rows.push(row);
      }
    }
  }
  return rows;
}

// Turndown core ships no table rule (it emits the cells as run-together text). The canonical
// turndown-plugin-gfm is unmaintained and escapes neither pipes nor newlines in cells, so we add a
// small self-contained GFM rule: first <tr> is the header, ragged rows are padded, cells sanitized.
function addGfmTableRule(service: TurndownService): void {
  service.addRule('gfmTable', {
    filter: 'table',
    replacement: (_content, node) => {
      const matrix = ownRows(node as Element)
        .map(rowCells)
        .filter((cells) => cells.length > 0);
      const [header, ...body] = matrix;
      if (!header) return '';
      const columns = Math.max(header.length, ...body.map((cells) => cells.length));
      const pad = (cells: string[]) => [...cells, ...Array(columns - cells.length).fill('')];
      const line = (cells: string[]) => `| ${pad(cells).join(' | ')} |`;
      const separator = `| ${Array(columns).fill('---').join(' | ')} |`;
      return ['', line(header), separator, ...body.map(line), ''].join('\n');
    },
  });
}

/**
 * Converts HTML content to clean, deterministic Markdown.
 * Configured to use ATX-style headings (#) and fenced code blocks (```), with GFM tables.
 */
export function htmlToMarkdown(html: string): string {
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
  });
  addGfmTableRule(turndownService);

  return turndownService.turndown(html);
}
