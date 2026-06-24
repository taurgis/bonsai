import { describe, it, expect } from 'vitest';
import { htmlToMarkdown } from './markdown.js';

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
});
