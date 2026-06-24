# Technical Research Notes

Use this before creating implementation tickets that add fetching, parsing, extraction, formatting, storage, or dependency work.

The bias is intentionally conservative: use Node 22 and the existing `forward-nexus` runtime first, add a dependency only when it removes real parsing complexity, and copy tiny stable helpers into the repo instead of adding packages for glue code.

## Recommended MVP Stack

| Concern | Recommendation | Why |
| --- | --- | --- |
| HTTP fetch | Use Node's global `fetch` plus `AbortSignal.timeout`. | Node already provides a stable browser-compatible `fetch`; no `node-fetch`, `got`, `axios`, or direct `undici` dependency needed for v1. |
| URL parsing | Use the WHATWG `URL` API. | It is the standard parser in Node and avoids legacy `url.parse` security footguns. |
| Hashing | Use `node:crypto` SHA-256. | Cache keys and content hashes do not need a package. |
| Atomic writes | Use `fs.promises.writeFile` to a temp file, then `fs.promises.rename`. | Enough for single-artifact writes; add locks only when a real race is observed. |
| DOM extraction | Use `@mozilla/readability`. | The article extraction heuristic is complex and battle-tested enough that owning it is not worth the maintenance. |
| DOM implementation | Spike `linkedom` first; fall back to `jsdom` only if fixtures fail. | Readability needs a DOM. `jsdom` is more complete but heavier; `linkedom` is explicitly smaller and SSR-oriented. |
| HTML to Markdown | Use `turndown` if detailed Markdown is required in v1. | Markdown conversion has enough edge cases that a dependency is cheaper than owning a converter. |
| Browser rendering | Defer Playwright. | It is useful for SPAs but too heavy and security-sensitive for the first cache primitive. |

## Default MVP Pipeline

1. Validate and normalize the URL.
2. Reject unsupported schemes and unsafe network targets before fetch.
3. Fetch with timeout, redirect limit, and byte limit.
4. Parse static HTML into a DOM.
5. Run Readability on a cloned document or disposable DOM.
6. Convert the extracted article to:
   - compressed output from text plus minimal structure
   - detailed output through Turndown only if the ticket includes detailed Markdown
7. Sanitize link targets and strip script/style/event-handler leftovers before storage.
8. Store one artifact and derive requested output formats from that artifact.

## URL Fetch to CLI Output Flow

The automatic URL path should stay boring and observable:

```text
forward-nexus research <url>
  -> parse args and flags
  -> normalize URL
  -> derive cache key
  -> scan cache artifacts for a fresh match
  -> return selected cached format when fresh
  -> fetch static HTML with limits
  -> parse HTML into DOM
  -> run Readability for main content
  -> convert extracted content to detailed Markdown
  -> derive compressed Markdown
  -> estimate tokens
  -> write one compatible artifact
  -> return selected format through human stdout or JSON envelope
```

The CLI output format is not the on-disk artifact. The artifact stores all compatible representations and metadata. The command returns only the requested representation:

- human mode: selected Markdown content on stdout
- `--json`: standard Forward Nexus envelope with metadata and selected content under `data`

If any stage cannot confidently extract main content, the command should fail without overwriting an existing good artifact. Do not silently store page chrome as if it were successful research.

## Agent-Supplied Research Fallback

Leave a compatible path for agents to supply research when automatic extraction fails.

Future command shapes:

```bash
forward-nexus research import <url> \
  --stdin \
  --input-format detailed \
  --topic "React docs" \
  --tags react \
  --tier standard \
  --json
```

```bash
forward-nexus research import \
  --source-url https://example.com/docs/a \
  --source-url https://example.com/docs/b \
  --stdin \
  --input-format detailed \
  --topic "React docs synthesis" \
  --tags react \
  --tier standard \
  --json
```

This path should not fetch the URL. It should:

1. validate and normalize one or more source URLs
2. derive the same cache key as `research <url>` for a single-source import
3. derive a topic-level research-note key for multi-source imports
3. read Markdown from stdin or a later `--file` flag
4. validate that content is non-empty and below the import size limit
5. store the same artifact shape as automatic extraction
6. mark the artifact as `capture_method: agent_supplied`
7. mark extraction status as `agent_supplied`
8. derive missing compressed output from detailed input when possible
9. return the standard JSON envelope

This keeps the cache useful when a page is an SPA, blocked, poorly parsed, or when the useful research is a synthesis across several URLs. Multi-source import stores the supplied synthesis; it does not ask the CLI to create one.

## Copy Into Our Repo Instead of Depending

These should be in-repo code unless a ticket proves they are harder than expected:

| Logic | Expected size | Notes |
| --- | ---: | --- |
| TTL parser for `2h`, `7d`, `30d` | < 60 LOC | Avoid `ms` or duration packages. Reject ambiguous units. |
| Tier policy lookup | < 30 LOC | Static map. No config system until needed. |
| URL normalizer | < 120 LOC | Build on `URL`; document the exact rules. |
| Cache key builder | < 30 LOC | Stable JSON/string tuple plus SHA-256. |
| Token estimate | < 40 LOC | Use a documented rough heuristic first, e.g. chars divided by 4. |
| Markdown compression filters | < 150 LOC | Remove images, collapse whitespace, simplify links, cap repeated blank lines. |
| Frontmatter writer | < 80 LOC | Emit a narrow YAML subset. Avoid general YAML until parsing arbitrary YAML is required. |
| Frontmatter reader | < 120 LOC | Parse only the schema we write, or use JSON sidecars instead. |
| Atomic artifact writer | < 80 LOC | Temp file plus rename; no locking package in v1. |
| Exit-code mapping | < 40 LOC | Reuse existing `forward-nexus` constants. |

Copy rule: only vendor third-party code when it is a single small file, permissively licensed, stable, covered by tests, and cheaper to maintain than a dependency. Do not vendor complex parsers, DOM implementations, browser automation, or extraction heuristics.

## Do Not Add for MVP

| Package type | Reason |
| --- | --- |
| HTTP clients such as `axios`, `got`, or `node-fetch` | Node fetch is enough. |
| CLI frameworks or prompt libraries | The target CLI already uses oclif and project command wrappers. |
| General validation libraries such as `zod` | The command surface is small; handwritten validation is clearer. |
| Cache libraries such as `cacache` | File artifacts plus scan-based lookup are enough until measured slow. |
| Locking libraries such as `proper-lockfile` | Start with atomic writes; add locks only after parallel write tests show a problem. |
| Markdown AST stacks such as unified/remark/rehype | Powerful but too much dependency surface for simple extraction and compression. |
| Browser automation such as Playwright/Puppeteer | Later optional fallback, not cache MVP. |
| Sanitization stacks such as DOMPurify/sanitize-html | Defer unless we render or persist HTML. For Markdown-only v1, strip dangerous elements/links and treat output as untrusted data. |

## Third-Party Library Notes

### `@mozilla/readability`

Use as a dependency. Do not copy it.

Readability returns article metadata and extracted content from a DOM document. Its options include parse limits such as `maxElemsToParse`, which is useful for memory control. It does not sanitize untrusted HTML, so tickets must still strip unsafe content and avoid rendering stored output as trusted HTML.

### `linkedom`

Spike as the first DOM candidate.

Its documented goal is a smaller, faster SSR-oriented DOM rather than full browser compatibility. That matches a static extraction MVP if Readability fixture tests pass. If it fails common docs fixtures, switch to `jsdom` rather than patching around DOM incompatibilities.

### `jsdom`

Use only if `linkedom` fails the extraction spike.

It is the compatibility baseline Readability documents for Node usage. Keep script execution disabled. Never use `runScripts: "dangerously"` for fetched internet content.

### `turndown`

Use only when detailed Markdown is in the implementation slice.

Turndown supports deterministic Markdown options such as ATX headings and fenced code blocks. If the first ticket only needs compressed output, return text from Readability and defer Turndown.

### `turndown-plugin-gfm`

Defer.

Tables are useful, but GFM support should wait until fixtures prove default Turndown output loses important docs content. A small custom table fallback may be enough.

### `robots-parser`

Defer unless robots.txt compliance is made an MVP requirement.

Robots parsing has edge cases, so do not hand-roll it if compliance becomes a real feature. Until then, keep traffic polite through caching, low concurrency, byte limits, and no automatic crawling.

### Playwright or Puppeteer

Defer to a later rendered-fetch command or explicit `--rendered` flag.

Browser rendering changes the threat model, package size, runtime, and test environment. It should not be pulled into the first URL cache ticket.

## Research Sources Checked

- Node global `fetch`: https://nodejs.org/api/globals.html#fetch
- Node WHATWG URL API: https://nodejs.org/api/url.html#the-whatwg-url-api
- Node `fs.promises.rename`: https://nodejs.org/api/fs.html#fspromisesrenameoldpath-newpath
- Node `crypto.createHash`: https://nodejs.org/api/crypto.html#cryptocreatehashalgorithm-options
- Mozilla Readability: https://github.com/mozilla/readability
- Turndown: https://github.com/mixmark-io/turndown
- jsdom: https://github.com/jsdom/jsdom
- linkedom: https://github.com/WebReflection/linkedom
