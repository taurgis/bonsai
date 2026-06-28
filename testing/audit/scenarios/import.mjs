/** import command validation and stdin/file modes. */
export default function register(harness, fixtures) {
  const { check, run, expect, parseJson } = harness;
  const { createWorkspace, writeNote } = fixtures;

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

  check('import missing url --json MISSING_URL', () => {
    const r = run(['import', '--stdin', '--json'], { input: '# hi\n' });
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'MISSING_URL', 'code');
  });

  check('import missing input --json MISSING_INPUT', () => {
    const r = run(['import', 'https://example.com/x', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'MISSING_INPUT', 'code');
  });

  check('import empty stdin --json EMPTY_INPUT', () => {
    const r = run(['import', 'https://example.com/x', '--stdin', '--json'], { input: '   ' });
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'EMPTY_INPUT', 'code');
  });

  check('import scheme-less URL hints the https form --json MISSING_URL_SCHEME', () => {
    const r = run(['import', 'example.com/page', '--stdin', '--json'], { input: '# x\n' });
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'MISSING_URL_SCHEME', env?.code);
    expect(env?.stderr?.includes('https://example.com/page'), env?.stderr);
  });

  check('import file not found --json FILE_NOT_FOUND', () => {
    const r = run(['import', 'https://example.com/x', '--file', '/no/such/file.md', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'FILE_NOT_FOUND', 'code');
  });

  check('import url+source-url --json CONFLICTING_FLAGS', () => {
    const r = run(
      ['import', 'https://a.com', '--source-url', 'https://b.com', '--stdin', '--json'],
      { input: '# x\n' }
    );
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'CONFLICTING_FLAGS', 'code');
  });

  check('import multi no topic --json MISSING_TOPIC', () => {
    const r = run(['import', '--stdin', '--source-url', 'https://a.com', '--json'], {
      input: '# x\n',
    });
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'MISSING_TOPIC', 'code');
  });

  check('import invalid ttl --json INVALID_DURATION exit 2', () => {
    const r = run(['import', 'https://example.com/x', '--stdin', '--ttl', '5z', '--json'], {
      input: '# x\n',
    });
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.code === 'INVALID_DURATION', env?.code);
    expect(r.exitCode === env?.exitCode, 'process vs envelope exit');
  });

  check('import success --json envelope shape', () => {
    const r = run(['import', 'https://example.com/import-test', '--stdin', '--json'], {
      input: '# Test\n\nContent here.\n',
    });
    const env = parseJson(r.stdout);
    expect(r.exitCode === 0, `exit ${r.exitCode} ${r.stderr}`);
    expect(env?.ok === true, 'ok false');
    expect(env?.data?.cache?.status === 'imported', JSON.stringify(env?.data?.cache));
  });

  check('import --file - reads stdin --json', () => {
    const r = run(['import', 'https://example.com/import-file-dash', '--file', '-', '--json'], {
      input: '# Dash\n\nContent from stdin placeholder.\n',
    });
    const env = parseJson(r.stdout);
    expect(r.exitCode === 0, `exit ${r.exitCode} ${r.stderr}`);
    expect(r.stderr === '', `stderr: ${r.stderr.slice(0, 120)}`);
    expect(env?.ok === true, 'ok false');
    expect(env?.data?.content?.includes('stdin placeholder'), 'content');
  });

  check('import from file in workspace', () => {
    const ws = createWorkspace();
    const file = writeNote(ws.cwd, 'notes.md', '# File import\n\nFrom audit fixture.\n');
    const r = run(['import', 'https://example.com/file-fixture', '--file', file, '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.data?.cache?.status === 'imported', 'imported');
  });
}
