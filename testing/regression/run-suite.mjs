// Live regression suite. Fetches each fixture URL the way `research <url>` would, normalizes the
// rendered Markdown, and diffs it against a committed baseline to catch regressions, information
// loss, and chrome/menu/placeholder LEAKAGE that wastes agent tokens. Requires network + a local
// Chrome (same as a real fetch).
//
// Each fixture is captured by one of two paths, chosen per fixture:
//   • `site: "<id>"`  → the custom SiteModule.fetchPage (e.g. Salesforce LWR shadow-DOM extraction)
//   • no `site`       → the generic capturePage pipeline (static → route/source Markdown → rendered)
//
//   pnpm regression:suite              # fetch + compare, write report (no baseline change)
//   pnpm regression:promote            # adopt current output as the new baseline
//   pnpm regression:check              # strict: non-zero exit on drift / new / failed / leakage
//   node testing/regression/run-suite.mjs vue node   # only fixtures whose id matches a filter term
//
// Run `pnpm build` first — this imports the compiled modules from dist/.
import fs from 'node:fs/promises';
import path from 'node:path';
import { getSiteModuleById } from '../../dist/sites/index.js';
import { capturePage } from '../../dist/lib/research/capture.js';
import { fetchStaticHtml, fetchText } from '../../dist/lib/research/fetcher.js';
import { fetchRenderedHtml } from '../../dist/lib/research/browser.js';
import {
  normalizeRegressionMarkdown,
  contentMetrics,
  leakageSignals,
} from '../../dist/lib/research/regression.js';

const ROOT_DIR = path.join('testing', 'regression');
const FIXTURES_PATH = path.join(ROOT_DIR, 'fixtures.json');
const CURRENT_DIR = path.join(ROOT_DIR, 'current');
const BASELINE_DIR = path.join(ROOT_DIR, 'baseline');

// Structural signals where a drop almost certainly means lost content, not benign wording changes.
const INFO_LOSS_KEYS = ['chars', 'codeBlocks', 'tables', 'images', 'orderedSteps', 'headings'];

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const filters = argv.filter((a) => !a.startsWith('--'));
const promote = flags.has('--promote');
const strict = flags.has('--strict');

const CAPTURE_DEPS = {
  fetchStatic: (url) => fetchStaticHtml(url),
  fetchRendered: (url) => fetchRenderedHtml(url),
  fetchText: (url) => fetchText(url),
};

// Captures a fixture via its custom site module, or the generic pipeline when no `site` is set.
async function captureFixture(fixture) {
  if (fixture.site) {
    const site = getSiteModuleById(fixture.site);
    if (!site) throw new Error(`Unknown site "${fixture.site}"`);
    if (!site.fetchPage) throw new Error(`Site "${fixture.site}" has no custom fetchPage`);
    const { extraction } = await site.fetchPage(fixture.url);
    return { extraction, captureMethod: `site:${fixture.site}` };
  }
  const outcome = await capturePage(fixture.url, {}, CAPTURE_DEPS);
  return { extraction: outcome.extraction, captureMethod: outcome.captureMethod };
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function pct(current, baseline) {
  if (!baseline) return null;
  return Number((((current - baseline) / baseline) * 100).toFixed(2));
}

function lostSignals(current, baseline) {
  if (!baseline) return [];
  return INFO_LOSS_KEYS.filter((key) => current[key] < baseline[key]).map(
    (key) => `${key} ${baseline[key]}→${current[key]}`
  );
}

const allFixtures = JSON.parse(await fs.readFile(FIXTURES_PATH, 'utf8'));
if (!Array.isArray(allFixtures) || allFixtures.length === 0) {
  throw new Error(`No fixtures found in ${FIXTURES_PATH}`);
}
const fixtures = filters.length
  ? allFixtures.filter((f) => filters.some((term) => (f.id || '').includes(term)))
  : allFixtures;
if (fixtures.length === 0) throw new Error(`No fixtures match filter: ${filters.join(', ')}`);

await fs.mkdir(CURRENT_DIR, { recursive: true });
await fs.mkdir(BASELINE_DIR, { recursive: true });

const startedAt = new Date().toISOString();
const results = [];

for (const [index, fixture] of fixtures.entries()) {
  const ordinal = String(index + 1).padStart(2, '0');
  const id = fixture.id || `fixture-${ordinal}`;
  const baselineMdPath = path.join(BASELINE_DIR, `${id}.md`);
  const currentMdPath = path.join(CURRENT_DIR, `${id}.md`);
  const currentJsonPath = path.join(CURRENT_DIR, `${id}.json`);

  try {
    const { extraction, captureMethod } = await captureFixture(fixture);
    const markdown = normalizeRegressionMarkdown(extraction.detailedMarkdown);
    const current = contentMetrics(markdown);
    const leaks = leakageSignals(markdown);
    await fs.writeFile(currentMdPath, `${markdown}\n`, 'utf8');

    const baselineExists = await fileExists(baselineMdPath);
    let baseline = null;
    let exactMatch = null;
    let infoLoss = [];
    if (baselineExists) {
      const baselineMarkdown = normalizeRegressionMarkdown(
        (await fs.readFile(baselineMdPath, 'utf8')).trimEnd()
      );
      baseline = contentMetrics(baselineMarkdown);
      exactMatch = baselineMarkdown === markdown;
      infoLoss = lostSignals(current, baseline);
    }

    const row = {
      id,
      site: fixture.site ?? null,
      url: fixture.url,
      title: extraction.title,
      focus: Array.isArray(fixture.focus) ? fixture.focus : [],
      captureMethod,
      current,
      baseline,
      exactMatch,
      charDeltaPct: baseline ? pct(current.chars, baseline.chars) : null,
      infoLoss,
      leaks,
      baselineExists,
      error: null,
    };
    await fs.writeFile(currentJsonPath, `${JSON.stringify({ fixture, analysis: row }, null, 2)}\n`, 'utf8');

    if (promote) await fs.copyFile(currentMdPath, baselineMdPath);

    const state = !baselineExists ? 'new' : exactMatch ? 'same' : infoLoss.length ? 'LOSS' : 'changed';
    const delta = baseline ? ` Δchars=${row.charDeltaPct ?? 0}%` : '';
    const loss = infoLoss.length ? `  ⚠ ${infoLoss.join(', ')}` : '';
    const leak = leaks.length ? `  ✗ LEAK: ${leaks.join(', ')}` : '';
    console.log(
      `[${ordinal}] ${state.padEnd(7)} ${(row.title || id).slice(0, 38).padEnd(38)} :: ${captureMethod.padEnd(16)} ${current.chars} chars${delta}${loss}${leak}`
    );
    results.push(row);
  } catch (error) {
    console.log(`[${ordinal}] error   ${id} :: ${String(error)}`);
    results.push({ id, site: fixture.site ?? null, url: fixture.url, error: String(error), baselineExists: await fileExists(baselineMdPath) });
  }
}

const summary = {
  startedAt,
  finishedAt: new Date().toISOString(),
  fixtureCount: fixtures.length,
  failed: results.filter((r) => r.error).length,
  unchanged: results.filter((r) => r.exactMatch === true).length,
  changed: results.filter((r) => r.exactMatch === false).length,
  infoLoss: results.filter((r) => r.infoLoss?.length).length,
  leaking: results.filter((r) => r.leaks?.length).length,
  new: results.filter((r) => !r.baselineExists && !r.error).length,
  promoted: promote,
};

await fs.writeFile(path.join(CURRENT_DIR, 'report.json'), `${JSON.stringify({ summary, results }, null, 2)}\n`, 'utf8');
if (promote) await fs.copyFile(path.join(CURRENT_DIR, 'report.json'), path.join(BASELINE_DIR, 'report.json'));

console.log('\nSummary:', summary);
if (summary.leaking > 0) console.log(`✗ ${summary.leaking} fixture(s) leaked chrome/menu/placeholder noise into Markdown.`);
if (summary.infoLoss > 0) console.log(`⚠ ${summary.infoLoss} fixture(s) lost structural content vs baseline.`);

if (strict) {
  const drift = summary.changed + summary.new;
  if (summary.failed > 0 || drift > 0 || summary.leaking > 0) {
    console.error(
      `Strict check failed: failed=${summary.failed}, changed=${summary.changed}, new=${summary.new}, infoLoss=${summary.infoLoss}, leaking=${summary.leaking}`
    );
    process.exitCode = 1;
  }
} else if (summary.failed > 0 || summary.leaking > 0) {
  process.exitCode = 1;
}
