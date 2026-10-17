import { describe, it, expect } from 'vitest';
import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';

const fixtures = {
  staticDoc: `
    <!DOCTYPE html>
    <html>
      <head><title>Technical Doc</title></head>
      <body>
        <main>
          <h1>API Reference</h1>
          <p>This is the official documentation for the API.</p>
        </main>
      </body>
    </html>
  `,
  articleWithBoilerplate: `
    <!DOCTYPE html>
    <html>
      <head><title>Article Title</title></head>
      <body>
        <nav>
          <ul>
            <li><a href="/">Home</a></li>
            <li><a href="/about">About</a></li>
          </ul>
        </nav>
        <article>
          <h1>The Rise of Agents</h1>
          <p class="author">By Antigravity</p>
          <p>Autonomous agents are changing the world of software development. They write code, execute tasks, and run benchmarks.</p>
        </article>
        <footer>
          <p>&copy; 2026 Forward NV</p>
        </footer>
      </body>
    </html>
  `,
  codeBlocks: `
    <!DOCTYPE html>
    <html>
      <body>
        <main>
          <h1>Code Example</h1>
          <p>Here is some TypeScript code:</p>
          <pre><code>const a = 1;
console.log(a);</code></pre>
        </main>
      </body>
    </html>
  `,
  malformedHtml: `
    <html>
      <head><title>Malformed Page</title></head>
      <body>
        <main>
          <h1>Malformed Page</h1>
          <p>This paragraph is never closed but should parse anyway because it contains enough text to satisfy readability scoring thresholds.
          <p>Readability checks for paragraph length and link density. If a paragraph is too short, it will not be scored high enough. By adding a few long sentences, we can ensure the parser detects the main article block correctly.
          <div>Another div
        </main>
      </body>
    </html>
  `,
};

describe('extraction spike: linkedom with readability', () => {
  it('extracts a technical doc', () => {
    const { document } = parseHTML(fixtures.staticDoc);
    const article = new Readability(document as any).parse();
    expect(article?.title).toBe('Technical Doc');
    expect(article?.textContent).toContain('This is the official documentation');
  });

  it('prunes navigation and footer boilerplate', () => {
    const { document } = parseHTML(fixtures.articleWithBoilerplate);
    const article = new Readability(document as any).parse();
    expect(article?.textContent).not.toContain('Home');
    expect(article?.textContent).not.toContain('About');
    expect(article?.textContent).not.toContain('2026 Forward NV');
    expect(article?.textContent).toContain('Autonomous agents are changing');
  });

  it('keeps fenced code', () => {
    const { document } = parseHTML(fixtures.codeBlocks);
    const article = new Readability(document as any).parse();
    expect(article?.content).toContain('<code>const a = 1;');
  });

  it('parses unclosed tags', () => {
    const { document } = parseHTML(fixtures.malformedHtml);
    const article = new Readability(document as any).parse();
    expect(article?.title).toBe('Malformed Page');
    expect(article?.textContent).toContain('This paragraph is never closed');
  });
});
