/** --toon: opt-in TOON-encoded envelope, alongside --json. */
import { decode } from '@toon-format/toon';

export default function register(harness, fixtures) {
  const { check, run, expect, parseJson } = harness;
  const { createWorkspace } = fixtures;

  check('list --toon empty cache decodes to the same envelope as --json', () => {
    const ws = createWorkspace();
    const jsonResult = run(['list', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    const toonResult = run(['list', '--toon'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(toonResult.exitCode === 0, `exit ${toonResult.exitCode}`);
    expect(toonResult.stderr === '', `stderr: ${toonResult.stderr}`);

    const jsonEnvelope = parseJson(jsonResult.stdout);
    const decoded = decode(toonResult.stdout);
    expect(decoded.schemaVersion === 1, 'schemaVersion');
    expect(decoded.command === 'list', decoded.command);
    expect(Array.isArray(decoded.data) && decoded.data.length === 0, 'empty data array');
    expect(decoded.ok === jsonEnvelope.ok, 'ok parity with --json');
  });

  check('list --toon with a cached entry decodes to the same fields as --json', () => {
    const ws = createWorkspace();
    const url = 'https://example.com/audit-toon-list';
    const imported = run(['import', url, '--stdin', '--topic', 'ToonAudit', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Toon audit fixture\n',
    });
    expect(imported.exitCode === 0, `import exit ${imported.exitCode}`);

    const jsonResult = run(['list', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    const jsonRow = parseJson(jsonResult.stdout)?.data?.[0];

    const toonResult = run(['list', '--toon'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(toonResult.exitCode === 0, `exit ${toonResult.exitCode}`);
    // TOON's own syntax proves this is a real re-encoding, not JSON under a different flag name.
    expect(toonResult.stdout.includes('data[1]'), toonResult.stdout);
    expect(!toonResult.stdout.trim().startsWith('{'), 'should not look like JSON');

    const decodedRow = decode(toonResult.stdout).data?.[0];
    expect(decodedRow?.cacheKey === jsonRow?.cacheKey, 'cacheKey parity');
    expect(decodedRow?.topic === jsonRow?.topic, 'topic parity');
    expect(JSON.stringify(decodedRow?.sourceUrls) === JSON.stringify(jsonRow?.sourceUrls), 'sourceUrls parity');
  });

  check('status --toon cache miss decodes to the same error envelope as --json', () => {
    const url = 'https://example.com/audit-toon-status-miss';
    const jsonResult = run(['status', url, '--json']);
    const jsonEnvelope = parseJson(jsonResult.stdout);

    const toonResult = run(['status', url, '--toon']);
    expect(toonResult.exitCode === 1, `exit ${toonResult.exitCode}`);
    const decoded = decode(toonResult.stdout);
    expect(decoded.code === 'CACHE_MISS', decoded.code);
    expect(decoded.code === jsonEnvelope.code, 'code parity with --json');
    expect(decoded.exitCode === jsonEnvelope.exitCode, 'exitCode parity with --json');
    expect(decoded.ok === false, 'ok false');
  });

  check('--toon suppresses human-mode table and tips on stderr, same as --json', () => {
    const ws = createWorkspace();
    const url = 'https://example.com/audit-toon-human-suppress';
    const imported = run(['import', url, '--stdin', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Toon suppression fixture\n',
    });
    expect(imported.exitCode === 0, `import exit ${imported.exitCode}`);

    const r = run(['status', url, '--toon'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(r.stderr === '', `stderr should be clean under --toon: ${r.stderr}`);
    expect(!r.stdout.includes('Status:'), 'no human table under --toon');
  });

  check('list --toon before the command works, same flag placement as --json', () => {
    const r = run(['--toon', 'list']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(decode(r.stdout).command === 'list', 'command id');
  });

  check('--json --toon together is CONFLICTING_FLAGS exit 2 (real --json wins the envelope format)', () => {
    const r = run(['list', '--json', '--toon']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'CONFLICTING_FLAGS', env?.code);
    expect(env?.ok === false, 'ok false');
    expect(env?.stderr?.includes('Cannot combine --json and --toon'), env?.stderr);
  });

  check('--toon --json together also reports CONFLICTING_FLAGS regardless of flag order', () => {
    const r = run(['list', '--toon', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'CONFLICTING_FLAGS', env?.code);
  });
}
