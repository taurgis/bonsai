# Token-Saving Strategy

This document defines how the research command should reduce agent context usage without adding a large dependency stack.

## Token Budget Goal

The command should save tokens by default through three boring mechanisms:

1. do not fetch again when a fresh cache hit exists
2. do not store or return page chrome
3. return compressed output unless detailed output is requested

The first implementation does not need perfect token accounting. It needs deterministic output and a rough estimate that is good enough for an agent to choose between compressed and detailed content.

## Compression Levels

### Compressed

Default for `forward-nexus research <url>`.

Keep:

- title
- short excerpt or summary if available from extraction
- headings
- key paragraphs
- code/API identifiers
- warnings, deprecations, version notes
- source URL and fetched timestamp

Remove or simplify:

- navigation
- sidebars
- cookie banners
- footers
- images
- social/share widgets
- repeated whitespace
- tracking query parameters in displayed links
- Markdown links when the URL does not add immediate value

Compressed output can be built with small in-repo functions. Do not add an AST pipeline until string-based filters fail fixture tests.

### Detailed

Use when a developer or agent needs exact structure, code examples, or links.

Keep:

- heading hierarchy
- code fences
- lists
- useful tables
- useful links
- provenance

Detailed output may justify `turndown`. Do not add GFM plugins until fixtures show table loss is a real problem.

## Estimate Heuristic

Use a documented heuristic first:

```text
estimated_tokens = ceil(character_count / 4)
```

This is intentionally rough. It avoids adding tokenizer packages and is stable enough for relative comparison between compressed and detailed outputs.

Add a real tokenizer only if a later ticket proves the rough estimate misleads agents in practice.

## Token-Saving Pipeline

```text
raw HTML
  -> byte limit
  -> DOM parse
  -> Readability extraction
  -> unsafe element/link cleanup
  -> detailed Markdown if requested/stored
  -> compressed Markdown
  -> token estimate
  -> cache artifact
```

For MVP, compressed output should be derived from the extracted article, not from raw HTML. This prevents page chrome from leaking into the shortest output.

## Dependency Impact on Token Savings

| Dependency | Saves output tokens? | Saves implementation work? | MVP stance |
| --- | --- | --- | --- |
| `@mozilla/readability` | Yes | Yes | Use. |
| `linkedom` | Indirectly | Yes | Spike first. |
| `jsdom` | Indirectly | Yes | Fallback. |
| `turndown` | Sometimes | Yes for detailed Markdown | Use only if detailed is in scope. |
| `turndown-plugin-gfm` | Sometimes | Maybe | Defer. |
| Playwright/Puppeteer | Sometimes for SPAs | No, adds large surface | Defer. |
| tokenizer packages | No | Slightly | Avoid. |
| Markdown AST packages | Maybe | No for MVP | Avoid. |

## Acceptance Checks

Before ticketing extraction work, define fixtures that prove:

- compressed output is smaller than detailed output
- compressed output does not lose title, warnings, code identifiers, or version notes
- detailed output preserves code fences and important links
- neither output contains scripts, style blocks, cookie-banner text, or navigation-heavy noise
- token estimates are emitted for every returned format

## Non-Goals

- Perfect semantic summarization.
- LLM-generated summaries in v1.
- Exact model-specific token counting.
- Automatic multi-page crawling.
- Browser-rendered SPA extraction.
