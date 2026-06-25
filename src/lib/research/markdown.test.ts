import { describe, it, expect } from 'vitest';
import { htmlToMarkdown, dropEmptyLinks } from './markdown.js';

describe('htmlToMarkdown GFM tables', () => {
  it('renders a thead/tbody table as a GFM pipe table', () => {
    const html =
      '<table><thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>' +
      '<tbody><tr><td>message</td><td>string</td><td>The message text of the java exception</td></tr>' +
      '<tr><td>levels</td><td>integer</td><td>Min value: 0</td></tr></tbody></table>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('| Field | Type | Description |');
    expect(md).toContain('| --- | --- | --- |');
    expect(md).toContain('| message | string | The message text of the java exception |');
    expect(md).toContain('| levels | integer | Min value: 0 |');
  });

  it('escapes pipes and collapses newlines inside cells', () => {
    const html =
      '<table><tr><th>Name</th><th>Note</th></tr>' +
      '<tr><td>query</td><td>a | b\nand\nc</td></tr></table>';
    const md = htmlToMarkdown(html);
    // The pipe in the cell is escaped, and the newlines are collapsed so the row stays intact.
    expect(md).toContain('| query | a \\| b and c |');
    expect(md.split('\n').filter((l) => l.startsWith('| query'))).toHaveLength(1);
  });

  it('pads ragged rows to the column count', () => {
    const html = '<table><tr><th>A</th><th>B</th></tr><tr><td>only-one</td></tr></table>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('| only-one |  |');
  });

  it('does not absorb a nested table’s rows into the outer table', () => {
    const html =
      '<table><tr><th>A</th><th>B</th></tr>' +
      '<tr><td><table><tr><td>inner</td></tr></table></td><td>outer</td></tr></table>';
    const md = htmlToMarkdown(html);
    const tableLines = md.split('\n').filter((l) => l.startsWith('|'));
    // header + separator + exactly one outer data row — the inner <tr> must not appear as a row.
    expect(tableLines).toHaveLength(3);
    expect(md).toContain('| A | B |');
  });

  it('drops text-less anchor links but keeps images and real links', () => {
    const md = htmlToMarkdown(
      '<p><a href="https://x/#h"></a>Heading</p>' +
        '<p><a href="https://x/y">Real</a></p>' +
        '<p><img src="https://x/i.png" alt=""></p>'
    );
    expect(md).not.toMatch(/(?<!!)\[\s*\]\(/);
    expect(md).toContain('[Real](https://x/y)');
    expect(md).toContain('![](https://x/i.png)');
    expect(md).toContain('Heading');
  });

  it('emits nothing for a table with no rows', () => {
    // An empty <table> has no header row, so the rule returns '' (the `if (!header)` branch).
    const md = htmlToMarkdown('<p>before</p><table></table><p>after</p>');
    expect(md).toContain('before');
    expect(md).toContain('after');
    expect(md).not.toContain('|');
  });

  it('ignores non-tr/non-section children when collecting a table’s own rows', () => {
    // A <caption> and a stray <div> are not rows and must not become phantom table lines.
    const html =
      '<table><caption>Cap</caption><div>x</div><tr><th>A</th></tr><tr><td>1</td></tr></table>';
    const md = htmlToMarkdown(html);
    const tableLines = md.split('\n').filter((l) => l.startsWith('|'));
    // header + separator + one data row.
    expect(tableLines).toHaveLength(3);
    expect(md).toContain('| A |');
    expect(md).toContain('| 1 |');
  });
});

describe('dropEmptyLinks', () => {
  it('removes text-less links but keeps images and labelled links', () => {
    expect(dropEmptyLinks('a [](https://x/#h) b')).toBe('a  b');
    expect(dropEmptyLinks('![](https://x/i.png)')).toBe('![](https://x/i.png)');
    expect(dropEmptyLinks('[real](https://x/y)')).toBe('[real](https://x/y)');
  });
});
