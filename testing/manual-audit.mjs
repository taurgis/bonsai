#!/usr/bin/env node
/**
 * Manual UX audit — runs happy and unhappy CLI paths and reports failures.
 * Usage: node testing/manual-audit.mjs
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(REPO, 'bin', 'cli.mjs');

const results = [];
let passed = 0;
let failed = 0;

function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

function run(args, opts = {}) {
  const cwd = opts.cwd ?? mkdtempSync(join(tmpdir(), 'bonsai-audit-'));
  mkdirSync(cwd, { recursive: true });
  const env = { ...process.env, ...opts.env };
  delete env.NO_COLOR;
  delete env.FORCE_COLOR;
  delete env.CI;
  delete env.BONSAI_STORAGE;
  const r = spawnSync('node', [CLI, ...args], {
    encoding: 'utf-8',
    cwd,
    env,
    input: opts.input ?? '',
    timeout: opts.timeout ?? 45000,
  });
  return {
    stdout: stripAnsi(r.stdout ?? ''),
    stderr: stripAnsi(r.stderr ?? ''),
    exitCode: r.status ?? 1,
  };
}

function parseJson(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

function check(name, fn) {
  try {
    fn();
    passed++;
    results.push({ name, ok: true });
  } catch (err) {
    failed++;
    results.push({ name, ok: false, error: err.message });
  }
}

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

// --- Help & discovery ---
check('root --help exits 0 with COMMANDS', () => {
  const r = run(['--help']);
  expect(r.exitCode === 0, `exit ${r.exitCode}`);
  expect(r.stdout.includes('COMMANDS'), 'missing COMMANDS');
  expect(r.stdout.includes('$ bonsai https://'), 'missing URL shorthand docs');
});

for (const cmd of ['search', 'inspect', 'status', 'list', 'import', 'prune', 'config']) {
  check(`${cmd} --help exits 0`, () => {
    const r = run([cmd, '--help']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(r.stdout.includes('USAGE') || r.stdout.includes('COMMANDS'), 'missing usage');
  });
}

// --- JSON envelope basics ---
check('--json list ok envelope', () => {
  const r = run(['list', '--json'], { raw: true });
  const env = parseJson(r.stdout);
  expect(r.exitCode === 0, `exit ${r.exitCode}`);
  expect(env?.schemaVersion === 1, 'schemaVersion');
  expect(env?.ok === true, 'ok');
  expect(r.stderr === '', `stderr noise: ${r.stderr.slice(0, 80)}`);
});

check('--json before command works', () => {
  const r = run(['--json', 'list']);
  expect(r.exitCode === 0, `exit ${r.exitCode}`);
  expect(parseJson(r.stdout)?.command === 'list', 'command id');
});

check('--json alone returns usage envelope exit 2', () => {
  const r = run(['--json']);
  expect(r.exitCode === 2, `exit ${r.exitCode}`);
  const env = parseJson(r.stdout);
  expect(env?.ok === false, 'ok false');
  expect(env?.stderr?.includes('Missing URL or command'), env?.stderr);
});

// --- URL shorthand ---
check('fetch example.com human mode', () => {
  const r = run(['https://example.com']);
  expect(r.exitCode === 0, `exit ${r.exitCode}`);
  expect(r.stdout.includes('documentation examples'), 'content');
});

check('fetch ftp:// protocol error not command-not-found', () => {
  const r = run(['ftp://example.com']);
  expect(r.exitCode === 2, `exit ${r.exitCode}`);
  expect(r.stderr.includes('Only http:'), r.stderr);
  expect(!r.stderr.includes('not found'), r.stderr);
});

check('fetch --json invalid ttl INVALID_DURATION + exit 2 match', () => {
  const r = run(['https://example.com', '--ttl', '5z', '--json']);
  expect(r.exitCode === 2, `exit ${r.exitCode}`);
  const env = parseJson(r.stdout);
  expect(env?.code === 'INVALID_DURATION', env?.code);
  expect(env?.exitCode === 2, `envelope exit ${env?.exitCode}`);
});

// --- inspect / status cache miss parity ---
const missUrl = 'https://example.com/audit-cache-miss-xyz';

check('inspect cache miss JSON CACHE_MISS exit 1', () => {
  const r = run(['inspect', missUrl, '--json']);
  expect(r.exitCode === 1, `exit ${r.exitCode}`);
  const env = parseJson(r.stdout);
  expect(env?.code === 'CACHE_MISS', env?.code);
  expect(env?.suggestions?.[0]?.includes('Fetch and cache'), env?.suggestions);
  expect(env?.stderr?.includes('Code: CACHE_MISS'), env?.stderr);
  expect(r.stderr === '', `stderr: ${r.stderr}`);
});

check('status cache miss JSON CACHE_MISS exit 1 with data', () => {
  const r = run(['status', missUrl, '--json']);
  expect(r.exitCode === 1, `exit ${r.exitCode}`);
  const env = parseJson(r.stdout);
  expect(env?.code === 'CACHE_MISS', env?.code);
  expect(env?.data?.status === 'miss', JSON.stringify(env?.data));
  expect(env?.suggestions?.[0]?.includes('Fetch and cache'), env?.suggestions);
});

check('status human cache miss warns on stderr not stdout', () => {
  const r = run(['status', missUrl]);
  expect(r.exitCode === 1, `exit ${r.exitCode}`);
  expect(r.stdout.includes('Status:'), 'table on stdout');
  expect(r.stdout.includes('miss'), 'miss status');
  expect(r.stderr.includes('Cache miss'), r.stderr);
});

check('inspect suggestion uses config.bin not hardcoded bonsai', () => {
  const r = run(['inspect', missUrl, '--json']);
  const env = parseJson(r.stdout);
  const sug = env?.suggestions?.[0] ?? '';
  expect(sug.startsWith('Fetch and cache it first: bonsai '), `suggestion: ${sug}`);
  expect(!sug.includes('bonsai bonsai'), sug);
});

// --- search ---
check('search empty query exit 2 EMPTY_QUERY', () => {
  const r = run(['search', '   ', '--json']);
  expect(r.exitCode === 2, `exit ${r.exitCode}`);
  const env = parseJson(r.stdout);
  expect(env?.code === 'EMPTY_QUERY', env?.code);
});

check('search invalid limit exit 2 INVALID_LIMIT', () => {
  const r = run(['search', 'test', '--limit', '0', '--json']);
  expect(r.exitCode === 2, `exit ${r.exitCode}`);
  expect(parseJson(r.stdout)?.code === 'INVALID_LIMIT', 'code');
});

check('search --domain and --remote conflict CONFLICTING_FLAGS', () => {
  const r = run(['search', 'foo', '--domain', 'react.dev', '--remote', 'https://react.dev', '--json']);
  expect(r.exitCode === 2, `exit ${r.exitCode}`);
  const env = parseJson(r.stdout);
  expect(env?.code === 'CONFLICTING_FLAGS', env?.code);
  expect(env?.suggestions?.length >= 2, 'suggestions');
});

check('search --remote invalid URL INVALID_URL no fallback', () => {
  const r = run(['search', 'foo', '--remote', 'notaurl', '--json']);
  expect(r.exitCode === 2, `exit ${r.exitCode}`);
  expect(parseJson(r.stdout)?.code === 'INVALID_URL', 'code');
});

check('search no results human tip', () => {
  const r = run(['search', 'zzzznonexistentquery99999']);
  expect(r.exitCode === 0, `exit ${r.exitCode}`);
  expect(r.stdout.includes('No matching'), r.stdout);
  expect(r.stdout.includes('populate the cache'), r.stdout);
});

check('search unsupported domain UNSUPPORTED_DOMAIN', () => {
  const r = run(['search', 'foo', '--domain', 'not-a-real-domain.example', '--json']);
  expect(r.exitCode === 2, `exit ${r.exitCode}`);
  expect(parseJson(r.stdout)?.code === 'UNSUPPORTED_DOMAIN', 'code');
});

// --- list ---
check('list invalid limit INVALID_LIMIT', () => {
  const r = run(['list', '--limit', '0', '--json']);
  expect(r.exitCode === 2, `exit ${r.exitCode}`);
  expect(parseJson(r.stdout)?.code === 'INVALID_LIMIT', 'code');
});

check('list human empty cache message', () => {
  const r = run(['list', '--topic', '__bonsai_audit_empty_topic__']);
  expect(r.exitCode === 0, `exit ${r.exitCode}`);
  expect(r.stdout.includes('No cached'), r.stdout.slice(0, 200));
});

// --- prune ---
check('prune no filters MISSING_FILTER with suggestions', () => {
  const r = run(['prune', '--json']);
  expect(r.exitCode === 2, `exit ${r.exitCode}`);
  const env = parseJson(r.stdout);
  expect(env?.code === 'MISSING_FILTER', env?.code);
  expect(env?.suggestions?.[0]?.includes('--dry-run'), env?.suggestions);
});

check('prune no --yes SAFETY_CHECK_REQUIRED', () => {
  const r = run(['prune', '--older-than', '90d', '--json']);
  expect(r.exitCode === 2, `exit ${r.exitCode}`);
  expect(parseJson(r.stdout)?.code === 'SAFETY_CHECK_REQUIRED', 'code');
});

check('prune invalid older-than exit 2', () => {
  const r = run(['prune', '--older-than', '5z', '--dry-run']);
  expect(r.exitCode === 2, `exit ${r.exitCode}`);
  expect(r.stderr.includes('Invalid --older-than'), r.stderr);
});

// --- import ---
check('import empty stdin exit 2', () => {
  const r = run(['import', 'https://example.com/x', '--stdin'], { input: '' });
  expect(r.exitCode === 2, `exit ${r.exitCode}`);
  expect(r.stderr.includes('Empty stdin'), r.stderr);
});

check('import url + source-url conflict', () => {
  const r = run(
    ['import', 'https://example.com/x', '--source-url', 'https://example.com/y', '--stdin'],
    { input: '# n\n' }
  );
  expect(r.exitCode === 2, `exit ${r.exitCode}`);
  expect(r.stderr.includes('Cannot specify both'), r.stderr);
});

// --- malformed URL ---
check('inspect malformed URL Could not parse not double Invalid URL', () => {
  const r = run(['inspect', 'notaurl']);
  expect(r.exitCode === 2, `exit ${r.exitCode}`);
  expect(r.stderr.includes('Could not parse') || r.stderr.includes('Invalid URL'), r.stderr);
  expect(!r.stderr.includes('Invalid URL: Invalid URL'), r.stderr);
});

// --- command not found ---
check('unknown command serch suggests search', () => {
  const r = run(['--json', 'serch', 'q']);
  expect(r.exitCode === 2, `exit ${r.exitCode}`);
  expect(parseJson(r.stdout)?.stderr?.includes('Did you mean search?'), 'suggestion');
});

check('unknown command wat no suggestion', () => {
  const r = run(['--json', 'wat']);
  expect(r.exitCode === 2, `exit ${r.exitCode}`);
  expect(!parseJson(r.stdout)?.stderr?.includes('Did you mean'), 'no suggestion');
});

// --- config ---
check('config --json lists subcommands', () => {
  const r = run(['config', '--json']);
  expect(r.exitCode === 0, `exit ${r.exitCode}`);
  const env = parseJson(r.stdout);
  expect(env?.data?.commands?.length > 0, 'commands');
});

// --- status invalid duration ---
check('status invalid ttl INVALID_DURATION', () => {
  const r = run(['status', 'https://example.com', '--ttl', '5z', '--json']);
  expect(r.exitCode === 2, `exit ${r.exitCode}`);
  expect(parseJson(r.stdout)?.code === 'INVALID_DURATION', 'code');
});

// --- no stack traces on usage errors ---
check('bogus flag no stack trace', () => {
  const r = run(['https://example.com', '--bogus']);
  expect(r.exitCode === 2, `exit ${r.exitCode}`);
  expect(r.stderr.includes('Nonexistent flag'), r.stderr);
  expect(!/\n\s+at /.test(r.stderr), 'stack trace');
});

console.log(`\nManual audit: ${passed} passed, ${failed} failed\n`);
for (const r of results.filter((x) => !x.ok)) {
  console.log(`FAIL: ${r.name}`);
  console.log(`  ${r.error}\n`);
}
process.exit(failed > 0 ? 1 : 0);
