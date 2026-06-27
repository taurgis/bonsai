/** BONSAI_* env override warnings. */
export default function register(harness) {
  const { check, run, expect, parseJson } = harness;

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
}
