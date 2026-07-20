/** BONSAI_* env override warnings and effects. */
export default function register(harness, fixtures) {
  const { check, run, expect, parseJson } = harness;
  const { createWorkspace } = fixtures;

  check('BONSAI_STORAGE typo warns on stderr under --json', () => {
    const r = run(['list', '--json'], { env: { BONSAI_STORAGE: 'projct' }, keepEnv: true });
    expect(r.stderr.includes('BONSAI_STORAGE'), r.stderr.slice(0, 120));
    expect(parseJson(r.stdout)?.ok === true, 'stdout envelope ok');
  });

  check('BONSAI_SUMMARY typo warns stderr not stdout json', () => {
    const r = run(['list', '--json'], { env: { BONSAI_SUMMARY: 'agressive' }, keepEnv: true });
    expect(r.stderr.includes('BONSAI_SUMMARY'), `no warn: ${r.stderr.slice(0, 120)}`);
    expect(parseJson(r.stdout)?.ok === true, 'stdout broken');
  });

  check('valid BONSAI_STORAGE=project actually redirects writes to the project cache', () => {
    const ws = createWorkspace();
    const url = 'https://example.com/audit-env-storage-project';
    const imported = run(['import', url, '--stdin', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      env: { BONSAI_STORAGE: 'project' },
      keepEnv: true,
      input: '# BONSAI_STORAGE env fixture\n',
    });
    expect(imported.exitCode === 0, `import exit ${imported.exitCode}`);
    const data = parseJson(imported.stdout)?.data;
    expect(data?.cache?.storage === 'project', `storage ${data?.cache?.storage}`);
    expect(data?.cache?.path?.includes('.bonsai'), `path ${data?.cache?.path}`);

    // Without the env override in a fresh workspace, the same import defaults back to global.
    const ws2 = createWorkspace();
    const importedDefault = run(['import', url, '--stdin', '--json'], {
      cwd: ws2.cwd,
      xdg: ws2.xdg,
      input: '# BONSAI_STORAGE env fixture\n',
    });
    expect(parseJson(importedDefault.stdout)?.data?.cache?.storage === 'global', 'default global');
  });

  // Long, sentence-diverse prose is required to clear the summarizer's floor (buildCompressed skips
  // documents under ~200 tokens) — a short/degenerate fixture would make conservative and aggressive
  // collapse to the same untouched output and hide a regression either way.
  function longProseFixture() {
    const sentences = [];
    for (let i = 0; i < 80; i++) {
      sentences.push(
        `This is sentence number ${i} describing topic ${i} in unique detail with extra words to pad length.`
      );
    }
    return `# Long Document\n\n${sentences.join(' ')}\n`;
  }

  check('valid BONSAI_SUMMARY=aggressive compresses more than conservative', () => {
    const ws = createWorkspace();
    const conservativeUrl = 'https://example.com/audit-env-summary-conservative';
    const aggressiveUrl = 'https://example.com/audit-env-summary-aggressive';
    const body = longProseFixture();

    const conservative = run(['import', conservativeUrl, '--stdin', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      env: { BONSAI_SUMMARY: 'conservative' },
      keepEnv: true,
      input: body,
    });
    expect(conservative.exitCode === 0, `conservative import exit ${conservative.exitCode}`);

    const aggressive = run(['import', aggressiveUrl, '--stdin', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      env: { BONSAI_SUMMARY: 'aggressive' },
      keepEnv: true,
      input: body,
    });
    expect(aggressive.exitCode === 0, `aggressive import exit ${aggressive.exitCode}`);

    // The compressed variant (not `detailed`, which import always returns verbatim) is what
    // BONSAI_SUMMARY tunes — retrieve it the same way an agent would: re-fetch the cached URL,
    // which defaults `--format` to compressed.
    const conservativeFetch = run([conservativeUrl, '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    const aggressiveFetch = run([aggressiveUrl, '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    const conservativeTokens = parseJson(conservativeFetch.stdout)?.data?.tokenEstimate;
    const aggressiveTokens = parseJson(aggressiveFetch.stdout)?.data?.tokenEstimate;
    expect(typeof conservativeTokens === 'number', `conservative tokens ${conservativeTokens}`);
    expect(typeof aggressiveTokens === 'number', `aggressive tokens ${aggressiveTokens}`);
    expect(
      aggressiveTokens < conservativeTokens,
      `aggressive (${aggressiveTokens}) should compress more than conservative (${conservativeTokens})`
    );
  });
}
