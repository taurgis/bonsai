import { expectNonIntegerLimitInvalid } from '../helpers.mjs';

/** search command: content/tag ranking, filters, and empty states. */
export default function register(harness, fixtures) {
  const { check, run, expect, parseJson } = harness;
  const { createWorkspace } = fixtures;

  check('search invalid limit INVALID_LIMIT', () => {
    const r = run(['search', '--limit', '0', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'INVALID_LIMIT', 'code');
  });

  check('search non-integer limit INVALID_LIMIT', () => {
    expectNonIntegerLimitInvalid(harness, ['search']);
  });

  check('search empty --query is INVALID_FLAG_VALUE, not a silent "match nothing"', () => {
    const r = run(['search', '--query', '  ', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'INVALID_FLAG_VALUE', 'code');
  });

  check('search empty --topic is INVALID_FLAG_VALUE', () => {
    const r = run(['search', '--topic', '  ', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
    expect(parseJson(r.stdout)?.code === 'INVALID_FLAG_VALUE', 'code');
  });

  check('search --artifact-type section is rejected (page-level only, like list)', () => {
    const r = run(['search', '--artifact-type', 'section', '--json']);
    expect(r.exitCode === 2, `exit ${r.exitCode}`);
  });

  check('search human empty cache message', () => {
    const r = run(['search']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(r.stdout.includes('No cached research entries found.'), r.stdout.slice(0, 200));
    expect(r.stdout.includes('populate the cache first'), r.stdout);
  });

  check('search empty cache --json returns clean empty data, no stderr tip', () => {
    const r = run(['search', '--json']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(Array.isArray(env?.data) && env.data.length === 0, 'empty data');
    expect(env?.stderr === '', `envelope stderr should stay empty: ${env?.stderr}`);
    expect(r.stderr === '', `process stderr should stay clean under --json: ${r.stderr}`);
  });

  check('search --json summary reports queried and definitive empty state', () => {
    const r = run(['search', '--query', 'no-such-audit-keyword-zzz', '--json']);
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    const env = parseJson(r.stdout);
    expect(env?.summary?.queried === true, `summary ${JSON.stringify(env?.summary)}`);
    expect(env?.summary?.empty === true, `summary ${JSON.stringify(env?.summary)}`);

    const noQuery = run(['search', '--json']);
    expect(parseJson(noQuery.stdout)?.summary?.queried === false, 'queried false without --query');
  });

  check('search --query ranks a topic match above a compressed-content-only match', () => {
    const ws = createWorkspace();
    const topicHitUrl = 'https://example.com/audit-search-topic-hit';
    const contentHitUrl = 'https://example.com/audit-search-content-hit';
    const importedTopic = run(
      ['import', topicHitUrl, '--stdin', '--topic', 'Lighthouse Ranking Topic', '--json'],
      { cwd: ws.cwd, xdg: ws.xdg, input: '# Lighthouse Ranking Topic\n\nUnrelated body text.\n' }
    );
    expect(importedTopic.exitCode === 0, `import exit ${importedTopic.exitCode}`);
    const importedContent = run(
      ['import', contentHitUrl, '--stdin', '--topic', 'Other Topic', '--json'],
      {
        cwd: ws.cwd,
        xdg: ws.xdg,
        input: '# Other Topic\n\nThis body mentions lighthouse only in passing.\n',
      }
    );
    expect(importedContent.exitCode === 0, `import exit ${importedContent.exitCode}`);

    const searched = run(['search', '--query', 'lighthouse', '--full', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    expect(searched.exitCode === 0, `search exit ${searched.exitCode}`);
    const rows = parseJson(searched.stdout)?.data;
    const topicIndex = rows.findIndex((r) => r.topic === 'Lighthouse Ranking Topic');
    const contentIndex = rows.findIndex((r) => r.topic === 'Other Topic');
    expect(topicIndex !== -1 && contentIndex !== -1, `rows ${JSON.stringify(rows)}`);
    expect(topicIndex < contentIndex, 'topic match should rank above content-only match');
    expect(rows[topicIndex].score > rows[contentIndex].score, 'topic match should score higher');
  });

  check('search AND semantics require every query term; OR (--match-any) needs only one', () => {
    const ws = createWorkspace();
    const bothUrl = 'https://example.com/audit-search-and-both';
    const partialUrl = 'https://example.com/audit-search-and-partial';
    const importedBoth = run(['import', bothUrl, '--stdin', '--topic', 'AuditAndBoth', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Audit And Both\n\nMentions auditkeyword and auditsecondword together.\n',
    });
    expect(importedBoth.exitCode === 0, `import exit ${importedBoth.exitCode}`);
    const importedPartial = run(
      ['import', partialUrl, '--stdin', '--topic', 'AuditAndPartial', '--json'],
      {
        cwd: ws.cwd,
        xdg: ws.xdg,
        input: '# Audit And Partial\n\nMentions only auditkeyword here.\n',
      }
    );
    expect(importedPartial.exitCode === 0, `import exit ${importedPartial.exitCode}`);

    const andSearch = run(
      ['search', '--query', 'auditkeyword auditsecondword', '--full', '--json'],
      { cwd: ws.cwd, xdg: ws.xdg }
    );
    const andRows = parseJson(andSearch.stdout)?.data;
    expect(andRows.some((r) => r.topic === 'AuditAndBoth'), 'AND should include the full match');
    expect(!andRows.some((r) => r.topic === 'AuditAndPartial'), 'AND should exclude the partial match');

    const orSearch = run(
      ['search', '--query', 'auditkeyword auditsecondword', '--match-any', '--full', '--json'],
      { cwd: ws.cwd, xdg: ws.xdg }
    );
    const orRows = parseJson(orSearch.stdout)?.data;
    expect(orRows.some((r) => r.topic === 'AuditAndPartial'), 'OR (--match-any) should include the partial match');
  });

  check('search combines --query with --tags (metadata filter narrows content search)', () => {
    const ws = createWorkspace();
    const url = 'https://example.com/audit-search-tag-combo';
    const imported = run(
      ['import', url, '--stdin', '--topic', 'TagComboSearch', '--tags', 'audit-combo-tag', '--json'],
      { cwd: ws.cwd, xdg: ws.xdg, input: '# Tag Combo Search\n\nDiscusses invalidation strategies.\n' }
    );
    expect(imported.exitCode === 0, `import exit ${imported.exitCode}`);

    const hit = run(
      ['search', '--query', 'invalidation', '--tags', 'audit-combo-tag', '--json'],
      { cwd: ws.cwd, xdg: ws.xdg }
    );
    expect(parseJson(hit.stdout)?.data?.length === 1, 'tag+query combo should hit');

    const miss = run(
      ['search', '--query', 'invalidation', '--tags', 'unrelated-audit-tag', '--json'],
      { cwd: ws.cwd, xdg: ws.xdg }
    );
    expect(parseJson(miss.stdout)?.data?.length === 0, 'mismatched tag should miss');
  });

  check('search default --json row is minimal with score/matchedFields/snippet; --full adds metadata', () => {
    const ws = createWorkspace();
    const url = 'https://example.com/audit-search-minimal-vs-full';
    const imported = run(
      ['import', url, '--stdin', '--topic', 'MinimalVsFullSearch', '--json'],
      { cwd: ws.cwd, xdg: ws.xdg, input: '# Minimal vs full search fixture\n\nMentions auditsnippetword here.\n' }
    );
    expect(imported.exitCode === 0, `import exit ${imported.exitCode}`);

    const minimal = run(['search', '--query', 'auditsnippetword', '--json'], { cwd: ws.cwd, xdg: ws.xdg });
    const minimalRow = parseJson(minimal.stdout)?.data?.[0];
    expect(
      minimalRow &&
        Object.keys(minimalRow).sort().join(',') ===
          'freshness,matchedFields,score,snippet,sourceUrls,tokenEstimate,topic',
      `minimal row keys ${JSON.stringify(minimalRow && Object.keys(minimalRow))}`
    );
    expect(minimalRow.snippet?.includes('auditsnippetword'), `snippet ${minimalRow.snippet}`);

    const full = run(['search', '--query', 'auditsnippetword', '--full', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    const fullRow = parseJson(full.stdout)?.data?.[0];
    expect(typeof fullRow?.cacheKey === 'string' && fullRow.cacheKey.length > 0, 'full row has cacheKey');
    expect(fullRow?.artifactType === 'source', 'full row has artifactType');
  });

  check('search --json limit truncation surfaces envelope.summary, no stderr tip', () => {
    const ws = createWorkspace();
    for (const url of [
      'https://example.com/audit-search-limit-one',
      'https://example.com/audit-search-limit-two',
    ]) {
      const imported = run(['import', url, '--stdin', '--topic', 'AuditSearchLimit', '--json'], {
        cwd: ws.cwd,
        xdg: ws.xdg,
        input: '# Audit Search Limit\n\nList truncation fixture.\n',
      });
      expect(imported.exitCode === 0, `import ${url} exit ${imported.exitCode}`);
    }

    const searched = run(['search', '--topic', 'AuditSearchLimit', '--limit', '1', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    const env = parseJson(searched.stdout);
    expect(searched.exitCode === 0, `search exit ${searched.exitCode}`);
    expect(env?.data?.length === 1, `data length ${env?.data?.length}`);
    expect(
      env?.summary?.total === 2 && env.summary.shown === 1 && env.summary.limit === 1 && env.summary.truncated === true,
      `summary ${JSON.stringify(env?.summary)}`
    );
    expect(searched.stderr === '', `process stderr should stay clean under --json: ${searched.stderr}`);
  });

  check('search defaults --limit to 10 (matching list) and suggests a nextCommand when truncated', () => {
    const ws = createWorkspace();
    for (let i = 0; i < 12; i++) {
      const imported = run(
        [
          'import',
          `https://example.com/audit-search-default-limit-${i}`,
          '--stdin',
          '--topic',
          `Audit Search Default Limit ${i}`,
          '--tags',
          'audit-search-default-limit-tag',
          '--json',
        ],
        {
          cwd: ws.cwd,
          xdg: ws.xdg,
          input: `# Audit Search Default Limit ${i}\n\nDefault limit fixture.\n`,
        }
      );
      expect(imported.exitCode === 0, `import ${i} exit ${imported.exitCode}`);
    }

    const searched = run(['search', '--tags', 'audit-search-default-limit-tag', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    const env = parseJson(searched.stdout);
    expect(searched.exitCode === 0, `search exit ${searched.exitCode}`);
    expect(env?.data?.length === 10, `data length ${env?.data?.length}`);
    expect(
      env?.summary?.total === 12 && env.summary.shown === 10 && env.summary.limit === 10 && env.summary.truncated === true,
      `summary ${JSON.stringify(env?.summary)}`
    );
    expect(
      /search --tags audit-search-default-limit-tag --json --limit 12$/.test(env?.summary?.nextCommand ?? ''),
      `nextCommand ${env?.summary?.nextCommand}`
    );
  });

  check('search --json summary.nextCommand is null when nothing was truncated', () => {
    const ws = createWorkspace();
    const imported = run(
      [
        'import',
        'https://example.com/audit-search-no-truncation',
        '--stdin',
        '--topic',
        'SearchNoTruncation',
        '--json',
      ],
      { cwd: ws.cwd, xdg: ws.xdg, input: '# Search No Truncation\n\nFixture.\n' }
    );
    expect(imported.exitCode === 0, `import exit ${imported.exitCode}`);

    const searched = run(['search', '--topic', 'SearchNoTruncation', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
    });
    const env = parseJson(searched.stdout);
    expect(
      env?.summary?.nextCommand === null,
      `nextCommand ${JSON.stringify(env?.summary?.nextCommand)}`
    );
  });

  check('search human mode renders score, matched fields, and a snippet when queried', () => {
    const ws = createWorkspace();
    const url = 'https://example.com/audit-search-human-render';
    const imported = run(['import', url, '--stdin', '--topic', 'Human Render Search', '--json'], {
      cwd: ws.cwd,
      xdg: ws.xdg,
      input: '# Human Render Search\n\nMentions auditrenderword in the body.\n',
    });
    expect(imported.exitCode === 0, `import exit ${imported.exitCode}`);

    const r = run(['search', '--query', 'auditrenderword'], { cwd: ws.cwd, xdg: ws.xdg });
    expect(r.exitCode === 0, `exit ${r.exitCode}`);
    expect(r.stdout.includes('Found 1 matching cached research entry:'), r.stdout.slice(0, 200));
    expect(/Score: \d+/.test(r.stdout), r.stdout);
    expect(r.stdout.includes('Matched:'), r.stdout);
    expect(r.stdout.includes('Snippet:'), r.stdout);
    expect(r.stdout.includes('auditrenderword'), r.stdout);
  });
}
