import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SITES, getSiteModuleById } from '../../src/sites/index.js';

// Offline guard for the live regression suite (testing/regression). This does NOT fetch anything;
// it enforces the "semi requirement" that every custom integration carries baseline coverage so a
// future fetch change can be caught by `pnpm regression:check` before it silently loses content.

interface Fixture {
  id: string;
  // Custom-integration fixtures set a site-module id; generic-pipeline fixtures (most docs sites)
  // omit it and are captured through capturePage.
  site?: string;
  url: string;
  focus?: string[];
}

const fixtures = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../testing/regression/fixtures.json', import.meta.url)),
    'utf8'
  )
) as Fixture[];

describe('regression fixtures manifest', () => {
  it('has well-formed entries with unique ids and resolvable sites', () => {
    const ids = new Set<string>();
    for (const fixture of fixtures) {
      expect(fixture.id, 'fixture id').toBeTruthy();
      expect(ids.has(fixture.id), `duplicate fixture id "${fixture.id}"`).toBe(false);
      ids.add(fixture.id);
      expect(() => new URL(fixture.url), `invalid url for "${fixture.id}"`).not.toThrow();
      // A `site` is optional (generic-pipeline fixtures omit it); when present it must resolve.
      if (fixture.site) {
        expect(
          getSiteModuleById(fixture.site),
          `unknown site "${fixture.site}" in "${fixture.id}"`
        ).toBeDefined();
      }
    }
  });

  // Custom fetchPage = a custom integration whose extraction can silently regress; the generic
  // pipeline (react, tanstack) is shared and covered elsewhere, so it is not required here.
  it('requires every site with a custom fetchPage to have baseline fixtures', () => {
    const covered = new Set(fixtures.map((fixture) => fixture.site));
    const uncovered = SITES.filter((site) => site.fetchPage && !covered.has(site.id)).map(
      (site) => site.id
    );
    expect(
      uncovered,
      `custom-fetch sites missing regression fixtures: ${uncovered.join(', ')}`
    ).toEqual([]);
  });
});
