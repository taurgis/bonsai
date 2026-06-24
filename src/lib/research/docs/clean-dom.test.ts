import { describe, it, expect } from 'vitest';
import { parseHTML } from 'linkedom';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanDocsChrome } from './clean-dom.js';
import { extractHtmlContent } from '../extract.js';

const FIXTURES = join(import.meta.dirname, '__fixtures__');
const load = (name: string) => readFileSync(join(FIXTURES, name), 'utf8');

describe('cleanDocsChrome + extraction (T-21)', () => {
  it('drops base64 logo, contributor avatars, and customizer chrome but keeps prose', () => {
    const result = extractHtmlContent(
      load('landing-noisy.html'),
      'https://www.typescriptlang.org/'
    );
    expect(result.detailedMarkdown).not.toMatch(/data:image\/png;base64/);
    expect(result.detailedMarkdown).not.toMatch(/Toggle theme/);
    expect(result.detailedMarkdown).not.toMatch(/avatar|alice|bob/);
    expect(result.detailedMarkdown).toMatch(/TypeScript adds additional syntax/);
  });

  it('removes data: images directly', () => {
    const { document } = parseHTML(
      '<!doctype html><html><body><p>hi</p><img src="data:image/png;base64,AAAA"><img src="/real.png"></body></html>'
    );
    cleanDocsChrome(document);
    const imgs = Array.from(document.querySelectorAll('img')) as any[];
    expect(imgs).toHaveLength(1);
    expect(imgs[0].getAttribute('src')).toBe('/real.png');
  });
});
