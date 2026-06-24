import { describe, it, expect } from 'vitest';
import { extractHtmlContent } from './extract.js';

describe('HTML content extraction pipeline', () => {
  it('extracts structured detailed Markdown with headings and code fences', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Test Title</title></head>
        <body>
          <main>
            <h1>Main Title</h1>
            <p>This is paragraph text.</p>
            <pre><code>const x = 42;</code></pre>
          </main>
        </body>
      </html>
    `;

    const result = extractHtmlContent(html, 'https://example.com/docs');
    expect(result.title).toBe('Test Title');
    expect(result.detailedMarkdown).toContain('# Main Title');
    expect(result.detailedMarkdown).toContain('```\nconst x = 42;\n```');
    expect(result.confidence).toBe('low'); // Very short content
    expect(result.qualityNotes).toContain(
      'warning: extracted content is very short (less than 500 characters)'
    );
  });

  it('resolves relative URLs and strips unsafe schemes', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <body>
          <main>
            <h1>Links</h1>
            <p>Relative links check.</p>
            <p>Check <a href="/docs/api">API docs</a> or <a href="../contact">contact</a>.</p>
            <p>Unsafe link <a href="javascript:alert(1)">Click Me</a>.</p>
          </main>
        </body>
      </html>
    `;

    const result = extractHtmlContent(html, 'https://example.com/some/path');
    expect(result.detailedMarkdown).toContain('(https://example.com/docs/api)');
    expect(result.detailedMarkdown).toContain('(https://example.com/contact)');
    expect(result.detailedMarkdown).not.toContain('javascript:alert(1)');
  });

  it('prunes script, style, iframe elements, and strips event handlers', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <body>
          <main>
            <h1>Sanitation Test</h1>
            <style>body { background: red; }</style>
            <script>console.log("XSS");</script>
            <iframe src="https://attacker.com"></iframe>
            <p onclick="stealCookies()">Clean content is here.</p>
          </main>
        </body>
      </html>
    `;

    const result = extractHtmlContent(html, 'https://example.com/docs');
    expect(result.detailedMarkdown).not.toContain('background: red');
    expect(result.detailedMarkdown).not.toContain('XSS');
    expect(result.detailedMarkdown).not.toContain('attacker.com');
    expect(result.detailedMarkdown).not.toContain('onclick');
    expect(result.detailedMarkdown).toContain('Clean content is here.');
  });

  it('fails clearly on non-readerable pages and provides a hint', () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <body>
          <div style="display:none">Empty page or boilerplate only</div>
        </body>
      </html>
    `;

    expect(() => extractHtmlContent(html, 'https://example.com/docs')).toThrow(
      /Content extraction failed.*Hint: A future "research import" command/
    );
  });

  it('assigns high confidence to longer extracted content', () => {
    // Construct a long text body to trigger high confidence (>=2000 characters)
    let longParagraphs = '';
    for (let i = 0; i < 40; i++) {
      longParagraphs +=
        '<p>This is a long paragraph containing some dummy text to increase the length of the extracted main article content for confidence classification purposes.</p>';
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Long Documentation</title></head>
        <body>
          <main>
            <h1>High Confidence Doc</h1>
            ${longParagraphs}
          </main>
        </body>
      </html>
    `;

    const result = extractHtmlContent(html, 'https://example.com/docs');
    expect(result.confidence).toBe('high');
    expect(result.qualityNotes).toEqual(['readability extracted main article']);
  });
});
