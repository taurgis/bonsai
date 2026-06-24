// Live regression suite. Fetches each fixture URL through its real site module (the actual custom
// integration), normalizes the rendered Markdown, and diffs it against a committed baseline to catch
// regressions and information loss. Requires network + a local Chrome (same as a real fetch).
//
//   pnpm regression:suite     # fetch + compare, write report (no baseline change)
//   pnpm regression:promote   # fetch + adopt current output as the new baseline
//   pnpm regression:check     # strict: non-zero exit on any drift / new / failed fixture
//
// Run `pnpm build` first — this imports the compiled modules from dist/.
import fs from 'node:fs/promises';
import path from 'node:path';
import { getSiteModuleById } from '../../dist/sites/index.js';
import { normalizeRegressionMarkdown, contentMetrics } from '../../dist/lib/research/regression.js';

const ROOT_DIR = path.join('testing', 'regression');
const FIXTURES_PATH = path.join(ROOT_DIR, 'fixtures.json');
const CURRENT_DIR = path.join(ROOT_DIR, 'current');
const BASELINE_DIR = path.join(ROOT_DIR, 'baseline');

const args = new Set(process.argv.slice(2));
const promote = args.has('--promote');
const strict = args.has('--strict');

// Structural signals where a drop almost certainly means lost content, not benign wording changes.
const INFO_LOSS_KEYS = ['chars', 'codeBlocks', 'tables', 'images', 'orderedSteps', 'headings'];

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

// Keys where current is meaningfully below baseline — the "loss of information" the suite guards.
function lostSignals(current, baseline) {
  if (!baseline) return [];
  return INFO_LOSS_KEYS.filter((key) => current[key] < baseline[key]).map(
    (key) => `${key} ${baseline[key]}→${current[key]}`
  );
}

const fixtures = JSON.parse(await fs.readFile(FIXTURES_PATH, 'utf8'));
if (!Array.isArray(fixtures) || fixtures.length === 0) {
  throw new Error(`No fixtures found in ${FIXTURES_PATH}`);
}

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
    const site = getSiteModuleById(fixture.site);
    if (!site) throw new Error(`Unknown site "${fixture.site}"`);
    if (!site.fetchPage) throw new Error(`Site "${fixture.site}" has no custom fetchPage`);

    const { extraction } = await site.fetchPage(fixture.url);
    const markdown = normalizeRegressionMarkdown(extraction.detailedMarkdown);
    const current = contentMetrics(markdown);
    await fs.writeFile(currentMdPath, `${markdown}\n`, 'utf8');

    const baselineExists = await fileExists(baselineMdPath);
    let baseline = null;
    let exactMatch = null;
    let infoLoss = [];
    if (baselineExists) {
      const baselineMarkdown = normalizeRegressionMarkdown((await fs.readFile(baselineMdPath, 'utf8')).trimEnd());
      baseline = contentMetrics(baselineMarkdown);
      exactMatch = baselineMarkdown === markdown;
      infoLoss = lostSignals(current, baseline);
    }

    const row = {
      id,
      site: fixture.site,
      url: fixture.url,
      title: extraction.title,
      focus: Array.isArray(fixture.focus) ? fixture.focus : [],
      current,
      baseline,
      exactMatch,
      charDeltaPct: baseline ? pct(current.chars, baseline.chars) : null,
      infoLoss,
      baselineExists,
      error: null,
    };
    await fs.writeFile(currentJsonPath, `${JSON.stringify({ fixture, analysis: row }, null, 2)}\n`, 'utf8');

    if (promote) await fs.copyFile(currentMdPath, baselineMdPath);

    const state = !baselineExists ? 'new' : exactMatch ? 'same' : infoLoss.length ? 'LOSS' : 'changed';
    const delta = baseline ? ` Δchars=${row.charDeltaPct ?? 0}%` : '';
    const loss = infoLoss.length ? `  ⚠ ${infoLoss.join(', ')}` : '';
    console.log(`[${ordinal}] ${state.padEnd(7)} ${(row.title || id).slice(0, 50)} :: ${current.chars} chars${delta}${loss}`);
    results.push(row);
  } catch (error) {
    console.log(`[${ordinal}] error   ${id} :: ${String(error)}`);
    results.push({ id, site: fixture.site, url: fixture.url, error: String(error), baselineExists: await fileExists(baselineMdPath) });
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
  new: results.filter((r) => !r.baselineExists && !r.error).length,
  promoted: promote,
};

await fs.writeFile(path.join(CURRENT_DIR, 'report.json'), `${JSON.stringify({ summary, results }, null, 2)}\n`, 'utf8');
if (promote) await fs.copyFile(path.join(CURRENT_DIR, 'report.json'), path.join(BASELINE_DIR, 'report.json'));

console.log('\nSummary:', summary);
if (summary.infoLoss > 0) console.log(`⚠ ${summary.infoLoss} fixture(s) lost structural content vs baseline.`);

if (strict) {
  const drift = summary.changed + summary.new;
  if (summary.failed > 0 || drift > 0) {
    console.error(`Strict check failed: failed=${summary.failed}, changed=${summary.changed}, new=${summary.new}, infoLoss=${summary.infoLoss}`);
    process.exitCode = 1;
  }
} else if (summary.failed > 0) {
  process.exitCode = 1;
}
