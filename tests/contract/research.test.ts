import { describe, it, expect } from 'vitest';
import { runContract } from './runner.ts';

describe('research contract tests', () => {
  it('bonsai --help exits 0 and lists top-level commands', () => {
    const result = runContract(['--help']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('COMMANDS');
    expect(result.stdout).toContain('import');
    expect(result.stdout).toContain('search');
    expect(result.stdout).toContain('config');
  });

  it('bonsai help exits 0 and lists top-level commands', () => {
    const result = runContract(['help']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('COMMANDS');
    expect(result.stdout).toContain('import');
  });

  it('bonsai without URL argument exits 0 and lists top-level commands', () => {
    const result = runContract([]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('COMMANDS');
  });

  it('bonsai --json without URL or command returns a JSON usage error', () => {
    const result = runContract(['--json'], { raw: true });
    expect(result.exitCode).toBe(2);
    const envelope = JSON.parse(result.stdout);
    expect(envelope).toMatchObject({
      schemaVersion: 1,
      command: 'bonsai',
      ok: false,
      exitCode: 2,
      stdout: '',
      data: null,
    });
    expect(envelope.stderr).toContain('Missing URL or command');
    expect(result.stderr).toBe('');
  });

  it('bonsai config --json returns structured subcommand metadata', () => {
    const result = runContract(['config', '--json'], { raw: true });
    expect(result.exitCode).toBe(0);
    const envelope = JSON.parse(result.stdout);
    expect(envelope).toMatchObject({
      schemaVersion: 1,
      command: 'config',
      ok: true,
      exitCode: 0,
      stdout: '',
      stderr: '',
      data: {
        topic: 'config',
        commands: expect.arrayContaining([
          expect.objectContaining({ id: 'config get' }),
          expect.objectContaining({ id: 'config set' }),
        ]),
      },
    });
    expect(result.stderr).toBe('');
  });

  it('accepts --json before a normal command', () => {
    const result = runContract(['--json', 'list'], { raw: true });
    expect(result.exitCode).toBe(0);
    const envelope = JSON.parse(result.stdout);
    expect(envelope).toMatchObject({
      schemaVersion: 1,
      command: 'list',
      ok: true,
      exitCode: 0,
      stdout: '',
      stderr: '',
    });
    expect(result.stderr).toBe('');
  });

  it('accepts --json before the URL shorthand and returns JSON error for unsupported scheme', () => {
    const result = runContract(['--json', 'ftp://example.com'], { raw: true });
    expect(result.exitCode).toBe(2);
    const envelope = JSON.parse(result.stdout);
    expect(envelope).toMatchObject({
      schemaVersion: 1,
      command: 'bonsai',
      ok: false,
      exitCode: 2,
      stdout: '',
      data: null,
    });
    expect(envelope.stderr).toContain('Only http: and https:');
  });

  it('accepts --json before an unknown command and returns the JSON error envelope', () => {
    const result = runContract(['--json', 'serch', 'alpha'], { raw: true });
    expect(result.exitCode).toBe(2);
    const envelope = JSON.parse(result.stdout);
    expect(envelope).toMatchObject({
      schemaVersion: 1,
      command: 'serch',
      ok: false,
      exitCode: 2,
      stdout: '',
      data: null,
    });
    expect(envelope.stderr).toContain('Did you mean search?');
    expect(result.stderr).toBe('');
  });

  it('does not invent a suggestion for unrelated short unknown commands', () => {
    const result = runContract(['--json', 'wat'], { raw: true });
    expect(result.exitCode).toBe(2);
    const envelope = JSON.parse(result.stdout);
    expect(envelope).toMatchObject({
      schemaVersion: 1,
      command: 'wat',
      ok: false,
      exitCode: 2,
      stdout: '',
      data: null,
    });
    expect(envelope.stderr).not.toContain('Did you mean');
  });

  it('bonsai with invalid flag value fails with exit code 2 (usage error)', () => {
    const result = runContract(['https://example.com', '--format', 'invalid-format']);
    expect(result.exitCode).toBe(2);
  });

  it('bonsai URL outputs mock content in human mode', () => {
    const result = runContract(['https://example.com']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('This domain is for use in documentation examples');
  });

  it('bonsai URL --json outputs structured JSON envelope', () => {
    const result = runContract(['https://example.com', '--json'], { raw: true });
    expect(result.exitCode).toBe(0);

    const envelope = JSON.parse(result.stdout);
    expect(envelope).toEqual({
      schemaVersion: 1,
      command: 'bonsai',
      ok: true,
      exitCode: 0,
      stdout: '',
      stderr: '',
      data: {
        schemaVersion: 1,
        command: 'bonsai',
        cache: {
          key: '0f115db062b7c0dd030b16878c99dea5c354b49dc37b38eb8846179c7783e9d7',
          status: expect.any(String),
          freshness: expect.any(String),
          path: expect.any(String),
          storage: expect.any(String),
          redirectedToGlobal: false,
        },
        source: {
          url: 'https://example.com',
          normalizedUrl: 'https://example.com/',
          // Capture method depends on live fetch + content-length heuristics (short pages fall back
          // to browser rendering), so assert shape not a fixed value — matching the sibling fields.
          captureMethod: expect.any(String),
          extractionStatus: 'extracted',
          extractionConfidence: expect.any(String),
          qualityNotes: expect.any(Array),
          fetchedAt: expect.any(String),
          validatedAt: expect.any(String),
          staleAfter: expect.any(String),
        },
        artifactType: expect.any(String),
        docsEngine: null,
        docsFramework: null,
        sourceDocUrl: null,
        searchProvider: null,
        format: 'compressed',
        tokenEstimate: expect.any(Number),
        content: expect.stringContaining('This domain is for use in documentation examples'),
      },
    });
  });
});

describe('CLI ergonomics and error contracts', () => {
  it('root --help documents the bare-URL shorthand', () => {
    const result = runContract(['--help']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('DESCRIPTION');
    expect(result.stdout).toContain('$ bonsai https://');
  });

  it('multi-source stdin import succeeds (stdin is not swallowed into the url arg)', () => {
    // Regression: oclif fills an omitted optional positional from piped stdin, which made
    // `import --stdin --source-url ...` wrongly report a positional/--source-url conflict. The
    // url arg sets ignoreStdin to prevent that. Writes to a project cache in the scratch cwd.
    const result = runContract(
      [
        'import',
        '--stdin',
        '--topic',
        'React docs',
        '--source-url',
        'https://react.dev/a',
        '--source-url',
        'https://react.dev/b',
      ],
      { input: '# Synthesized notes\n\nCombined research.\n', env: { BONSAI_STORAGE: 'project' } }
    );
    expect(result.stderr).not.toContain('Cannot specify both');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Successfully imported');
  });

  it('a malformed URL reports an actionable error without stuttering "Invalid URL"', () => {
    const result = runContract(['inspect', 'notaurl']);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Could not parse');
    // Regression: the native URL error ("Invalid URL") used to be appended to the command's own
    // "Invalid URL:" prefix, producing "Invalid URL: Invalid URL ... : Invalid URL".
    expect(result.stderr).not.toContain('Invalid URL: Invalid URL');
  });

  it('import with both an explicit url and --source-url still conflicts (exit 2)', () => {
    // ignoreStdin must not weaken the genuine conflict: an explicit positional token is still
    // assigned to url, so supplying both it and --source-url is a usage error even with stdin piped.
    const result = runContract(
      ['import', 'https://example.com/x', '--source-url', 'https://example.com/y', '--stdin'],
      { input: '# Notes\n\nContent.\n', env: { BONSAI_STORAGE: 'project' } }
    );
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Cannot specify both');
  });

  it('URL shorthand with an unknown flag fails cleanly (exit 2, no stack trace)', () => {
    const result = runContract(['https://example.com', '--bogus']);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Nonexistent flag: --bogus');
    // The shim must rewrite process.argv so the help renderer resolves `fetch`, not the bare
    // URL — otherwise oclif throws "command https://... not found" and dumps a stack trace.
    expect(result.stderr).not.toContain('not found');
    expect(result.stderr).not.toMatch(/\n\s+at /);
  });

  it('non-http(s) URL shorthand reports the protocol error, not "command not found"', () => {
    const result = runContract(['ftp://example.com']);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Only http: and https:');
    expect(result.stderr).not.toContain('command ftp://example.com not found');
  });

  it('scheme-only URLs like javascript: report a protocol error, not "command not found"', () => {
    const result = runContract(['javascript:alert(1)']);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Unsupported protocol');
    expect(result.stderr).not.toContain('is not a bonsai command');
  });

  it('status cache miss exits 1 while still returning structured JSON', () => {
    const result = runContract(['status', 'https://example.com/contract-cache-miss', '--json'], {
      raw: true,
    });
    expect(result.exitCode).toBe(1);
    const envelope = JSON.parse(result.stdout);
    expect(envelope).toMatchObject({
      ok: false,
      exitCode: 1,
      data: { status: 'miss', action: 'would_fetch' },
    });
    expect(result.stderr).toContain('Cache miss');
  });

  it('prune rejects a malformed --older-than value (exit 2) instead of silently matching nothing', () => {
    const result = runContract(['prune', '--older-than', '5z', '--dry-run']);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Invalid --older-than');
  });

  it('prune without filters suggests an example dry-run command', () => {
    const result = runContract(['prune', '--dry-run']);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Must specify at least one pruning filter');
    expect(result.stderr).toContain('older-than 90d');
    expect(result.stderr).toContain('--dry-run');
  });

  it('import with empty stdin is a usage error (exit 2)', () => {
    const result = runContract(['import', 'https://example.com/x', '--stdin'], { input: '' });
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Empty stdin content');
  });

  it('under --json a usage error exits the process with the same code as the envelope', () => {
    const result = runContract(['https://example.com', '--ttl', '5z', '--json'], { raw: true });
    // Guard before parsing so a non-JSON stdout regression fails with a readable message.
    expect(result.stdout.trim()).not.toBe('');
    const envelope = JSON.parse(result.stdout);
    expect(envelope.ok).toBe(false);
    expect(envelope.exitCode).toBe(2);
    // The process exit code must agree with the envelope — agents branch on the process code.
    expect(result.exitCode).toBe(2);
  });

  it('import with a missing --file reports the input error once (exit 2, no double prefix)', () => {
    const result = runContract([
      'import',
      'https://example.com/z',
      '--file',
      '/no/such/file-xyz.md',
    ]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('File does not exist');
    expect(result.stderr).not.toContain('Failed to read file');
  });

  it('inspect cache miss JSON includes actionable code and suggestions', () => {
    const result = runContract(['inspect', 'https://example.com/contract-cache-miss', '--json'], {
      raw: true,
    });
    expect(result.exitCode).toBe(1);
    const envelope = JSON.parse(result.stdout);
    expect(envelope).toMatchObject({
      ok: false,
      exitCode: 1,
      code: 'CACHE_MISS',
      suggestions: ['Fetch and cache it first: bonsai https://example.com/contract-cache-miss'],
      data: null,
    });
    expect(envelope.stderr).toContain('Code: CACHE_MISS');
    expect(envelope.stderr).toContain('Try this: Fetch and cache it first');
    expect(result.stderr).toBe('');
  });

  it('prune JSON usage error includes suggestions in the envelope', () => {
    const result = runContract(['prune', '--json'], { raw: true });
    expect(result.exitCode).toBe(2);
    const envelope = JSON.parse(result.stdout);
    expect(envelope.code).toBe('MISSING_FILTER');
    expect(envelope.suggestions?.[0]).toContain('prune --older-than 90d --dry-run');
    expect(envelope.stderr).toContain('Try this:');
  });

  it('prune JSON safety check includes SAFETY_CHECK_REQUIRED code', () => {
    const result = runContract(['prune', '--older-than', '90d', '--json'], { raw: true });
    expect(result.exitCode).toBe(2);
    const envelope = JSON.parse(result.stdout);
    expect(envelope.code).toBe('SAFETY_CHECK_REQUIRED');
    expect(envelope.suggestions?.[0]).toContain('--dry-run');
  });

  it('list JSON invalid limit includes INVALID_LIMIT in the envelope', () => {
    const result = runContract(['list', '--limit', '0', '--json'], { raw: true });
    expect(result.exitCode).toBe(2);
    const envelope = JSON.parse(result.stdout);
    expect(envelope.code).toBe('INVALID_LIMIT');
    expect(envelope.stderr).toContain('Code: INVALID_LIMIT');
  });

  it('fetch JSON duration errors include INVALID_DURATION in the envelope', () => {
    const result = runContract(['https://example.com', '--ttl', '5z', '--json'], { raw: true });
    const envelope = JSON.parse(result.stdout);
    expect(envelope).toMatchObject({
      ok: false,
      exitCode: 2,
      code: 'INVALID_DURATION',
    });
    expect(envelope.stderr).toContain('Code: INVALID_DURATION');
  });
});
