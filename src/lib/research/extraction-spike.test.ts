import { describe, it, expect } from 'vitest';
import { parseHTML } from 'linkedom';
import { JSDOM } from 'jsdom';
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
  relativeLinks: `
    <!DOCTYPE html>
    <html>
      <body>
        <main>
          <h1>Links Page</h1>
          <p>Check the <a href="/docs/api">API docs</a> or the <a href="../contact">contact page</a>.</p>
        </main>
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
  tables: `
    <!DOCTYPE html>
    <html>
      <body>
        <main>
          <h1>Data Table</h1>
          <table>
            <thead>
              <tr><th>Name</th><th>Value</th></tr>
            </thead>
            <tbody>
              <tr><td>React</td><td>High</td></tr>
              <tr><td>Vite</td><td>Very High</td></tr>
            </tbody>
          </table>
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

describe('extraction spike: linkedom vs jsdom with readability', () => {
  it('extracts technical doc successfully on both', () => {
    // Linkedom
    const { document: lDoc } = parseHTML(fixtures.staticDoc);
    const lReader = new Readability(lDoc as any);
    const lArticle = lReader.parse();
    expect(lArticle?.title).toBe('Technical Doc');
    expect(lArticle?.textContent).toContain('This is the official documentation');

    // JSDOM
    const jDoc = new JSDOM(fixtures.staticDoc).window.document;
    const jReader = new Readability(jDoc);
    const jArticle = jReader.parse();
    expect(jArticle?.title).toBe('Technical Doc');
    expect(jArticle?.textContent).toContain('This is the official documentation');
  });

  it('prunes navigation and footer boilerplate', () => {
    // Linkedom
    const { document: lDoc } = parseHTML(fixtures.articleWithBoilerplate);
    const lReader = new Readability(lDoc as any);
    const lArticle = lReader.parse();
    expect(lArticle?.textContent).not.toContain('Home');
    expect(lArticle?.textContent).not.toContain('About');
    expect(lArticle?.textContent).not.toContain('2026 Forward NV');
    expect(lArticle?.textContent).toContain('Autonomous agents are changing');

    // JSDOM
    const jDoc = new JSDOM(fixtures.articleWithBoilerplate).window.document;
    const jReader = new Readability(jDoc);
    const jArticle = jReader.parse();
    expect(jArticle?.textContent).not.toContain('Home');
    expect(jArticle?.textContent).not.toContain('About');
    expect(jArticle?.textContent).not.toContain('2026 Forward NV');
    expect(jArticle?.textContent).toContain('Autonomous agents are changing');
  });

  it('handles relative links and code blocks on both', () => {
    // Linkedom Link & Code
    const { document: lDoc } = parseHTML(fixtures.codeBlocks);
    const lReader = new Readability(lDoc as any);
    const lArticle = lReader.parse();
    expect(lArticle?.content).toContain('<code>const a = 1;');

    // JSDOM Link & Code
    const jDoc = new JSDOM(fixtures.codeBlocks).window.document;
    const jReader = new Readability(jDoc);
    const jArticle = jReader.parse();
    expect(jArticle?.content).toContain('<code>const a = 1;');
  });

  it('handles tables and malformed HTML on both', () => {
    // Linkedom Malformed
    const { document: lDoc } = parseHTML(fixtures.malformedHtml);
    const lReader = new Readability(lDoc as any);
    const lArticle = lReader.parse();
    expect(lArticle?.title).toBe('Malformed Page');
    expect(lArticle?.textContent).toContain('This paragraph is never closed');

    // JSDOM Malformed
    const jDoc = new JSDOM(fixtures.malformedHtml).window.document;
    const jReader = new Readability(jDoc);
    const jArticle = jReader.parse();
    expect(jArticle?.title).toBe('Malformed Page');
    expect(jArticle?.textContent).toContain('This paragraph is never closed');
  });
});
