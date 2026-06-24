import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractNextRscData } from './rsc.js';

const FIXTURES = join(import.meta.dirname, '__fixtures__');
const load = (name: string) => readFileSync(join(FIXTURES, name), 'utf8');

describe('extractNextRscData (T-26)', () => {
  it('extracts the Nextra page map route, title, and filePath hint', () => {
    const data = extractNextRscData(load('nextra.html'));
    const entry = data.pageMap.find((p) => p.url === '/docs');
    expect(entry?.title).toBe('Introduction');
    expect(entry?.sourcePath).toBe('app/docs/page.mdx');
    expect(data.sourcePathHints).toContain('app/docs/page.mdx');
  });

  it('returns empty arrays when there is no RSC payload', () => {
    const data = extractNextRscData('<html><body><h1>Plain</h1></body></html>');
    expect(data.pageMap).toHaveLength(0);
    expect(data.sourcePathHints).toHaveLength(0);
  });

  it('does not execute scripts — payload is scanned as text', () => {
    const malicious =
      '<script>self.__next_f=[[1,"{\\"route\\":\\"/x\\",\\"title\\":\\"X\\"}"]];globalThis.PWNED=1</script>';
    extractNextRscData(malicious);
    expect((globalThis as any).PWNED).toBeUndefined();
  });
});
