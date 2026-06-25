# Agent web fetch vs Bonsai

Every AI coding agent has a built-in way to read a web page. This page puts that
built-in fetch **head-to-head with Bonsai** on four popular library docs pages,
and measures what each one actually returns.

The headline isn't "Bonsai uses fewer tokens." It sometimes uses *more*. The point
is that **a built-in web fetch quietly drops, summarizes, or refuses content**,
while Bonsai returns the complete page every time, deterministically, and caches
it for reuse.

One section per agent. **Claude Code**, **Antigravity**, **Codex**, **Cursor**, and **Mistral Vibe** are documented below.

## Claude Code

> **Agent: Claude Code.** Its native **`WebFetch`** tool fetches the URL,
> converts the page to Markdown, and runs a **small, fast model** over it to
> answer a prompt.

::: info How we measured (tools used)
- **Agent web fetch:** Claude Code's native **`WebFetch`** tool. We asked it to
  reproduce the full page verbatim ("do not summarize, omit, or editorialize").
- **Bonsai:** the `@taurgis/bonsai` CLI with **default settings** (`compressed`
  format, `conservative` summary). Both cached variants come from one fetch.
- **Raw page:** a plain HTTP GET of the URL, the bytes you'd paste into context
  if you dumped the fetched page.
- **Tokens** are an estimate (`≈ chars / 4`) applied identically to every result,
  so the columns are comparable. Captured **2026-06-25** with `@taurgis/bonsai`
  **v1.0.3**. A model-backed tool like `WebFetch` is non-deterministic, so your
  figures will vary.
:::

### Results

| Page | What WebFetch returned | WebFetch | Bonsai `compressed` | Bonsai `detailed` | Raw page |
| --- | --- | --: | --: | --: | --: |
| React – `useEffect` | **Partial:** dropped ~37%: interactive sandboxes, multi-file demos, Pitfall/Deep-Dive callouts | 7,150 | **8,119** | 11,296 | 150,883 |
| TypeScript – Everyday Types | **Summarized:** Enums collapsed to one line, examples trimmed | 1,638 | **4,983** | 6,903 | 80,398 |
| Vue – Introduction | **Refused:** declined on copyright grounds; returned a 5-line summary | 337 | **1,520** | 2,105 | 28,523 |
| Next.js – Layouts and Pages | **Complete:** pulled Next's published Markdown source | 3,340 | **2,401** | 2,968 | 246,298 |

Read the WebFetch column carefully. The small numbers are not efficiency, they
are **missing documentation**. For React, 7,150 tokens looks lean until you
notice a third of the page is gone. For Vue, 337 tokens is a refusal.

**The one fair comparison is Next.js**, the only page WebFetch returned in full.
There, Bonsai's `compressed` cache is both **complete and 28% smaller**
(2,401 vs 3,340 tokens), and you can reuse it for free.

### What WebFetch left behind

This is the honest, uncomfortable part. The `detailed` variant preserves the
whole article, so measured against that complete capture, here's how much of each
page the agent fetch was missing, *despite being asked for everything*:

::: warning Content missing vs Bonsai's complete capture
- **React – `useEffect`:** ≈ **37% missing** (7,150 vs 11,296 tokens). Gone: the
  interactive sandboxes, the multi-file chat/api demos, and the Pitfall/Deep-Dive
  callouts.
- **TypeScript – Everyday Types:** ≈ **76% missing** (1,638 vs 6,903). Most code
  examples are gone and the Enums section collapsed to a single sentence.
- **Vue – Introduction:** ≈ **84% missing** (337 vs 2,105). A refusal, not a page.
- **Next.js – Layouts and Pages:** **no meaningful loss.** WebFetch happened to
  find Next's published Markdown source, so it matched Bonsai here.

Three of four reads silently dropped most of the documentation. Bonsai returned
all four pages in full.
:::

Token delta is a proxy for content loss, but it lines up with the specific
sections each result dropped (listed above), and the project's regression suite
guards Bonsai's `detailed` variant against content loss. The danger isn't the
smaller token count. It's that **the agent never tells you what it left out.**

### Why WebFetch behaves this way

There's a model in the loop. `WebFetch` fetches the page, converts it to Markdown,
and runs a small fast model to answer your prompt. That has four consequences for
documentation:

- **Lossy.** Output is bounded and the model trims to fit, so long pages lose
  content (often the code examples and tables you actually came for).
- **Non-deterministic.** The same URL with a different prompt or model gives a
  different result. You can't pin it.
- **It can refuse,** as Vue did, on copyright grounds.
- **Not reusable.** It's a one-shot answer, cached only minutes. The next agent,
  or the next session, pays the full fetch-and-summarize cost again.

### Worked example: React's `useEffect`

What the agent's `WebFetch` was asked, and what came back:

```text
WebFetch(
  url: "https://react.dev/reference/react/useEffect",
  prompt: "Reproduce the complete documentation content ... Do NOT summarize,
           condense, omit, or editorialize."
)
→ 7,150 tokens — but missing the interactive examples, the multi-file chat/api
  demos, and the Pitfall/Deep-Dive callouts.
```

The same page through Bonsai, with defaults:

```bash
npx @taurgis/bonsai https://react.dev/reference/react/useEffect
npx @taurgis/bonsai inspect https://react.dev/reference/react/useEffect --json
```

```json
{
  "source_url": "https://react.dev/reference/react/useEffect",
  "capture_method": "static_fetch",
  "extraction_status": "extracted",
  "token_estimate": {
    "compressed": 8119,
    "detailed": 11296
  }
}
```

That's 8,119 tokens for the **complete** reference, cached and reusable, versus a
7,150-token fetch that silently left a third of the page behind.

## Antigravity

> **Agent: Antigravity.** Its native **`read_url_content`** tool fetches the URL
> and saves the raw HTML response body directly into a workspace file.

::: info How we measured (tools used)
- **Agent web fetch:** Antigravity's native **`read_url_content`** tool. We took
  the character length of the raw output file saved to the workspace (`≈ chars / 4`).
- **Bonsai:** the `@taurgis/bonsai` CLI run with **default settings** (`compressed`
  format, `conservative` summary). One fetch produces both cached variants.
- **Raw page:** a plain HTTP GET of the URL.
- **Tokens** are an estimate (`≈ chars / 4`) applied identically to every result,
  so the columns are comparable. Captured **2026-06-25** with `@taurgis/bonsai`
  **v1.0.3**.
:::

### Results

| Page | What read_url_content returned | read_url_content | Bonsai `compressed` | Bonsai `detailed` | Raw page |
| --- | --- | --: | --: | --: | --: |
| React – `useEffect` | **Raw HTML:** complete raw HTML source containing all scripts/styles | 150,905 | **8,119** | 11,296 | 150,883 |
| TypeScript – Everyday Types | **Raw HTML:** complete raw HTML source containing all scripts/styles | 19,377 | **4,983** | 6,903 | 80,398 |
| Vue – Introduction | **Empty Shell:** returned initial static HTML containing only menus; main content was client-rendered | 4,494 | **1,520** | 2,105 | 28,523 |
| Next.js – Layouts and Pages | **Raw HTML:** complete raw HTML source containing all scripts/styles | 245,393 | **2,401** | 2,968 | 246,298 |

### What read_url_content left behind

Where Claude Code's model-backed tool summarizes or drops sections, Antigravity's `read_url_content` fetches the full page response. That brings its own problems:

- **React, TypeScript, Next.js: no content loss, but massive token waste.** The tool returns the raw HTML document verbatim, spending **93% to 99%** of the token budget on boilerplate scripts, SVG icons, and inline styles that Bonsai's Markdown extraction strips.
- **Vue – Introduction: 84% content loss.** Vue renders client-side (SPA navigation and hydration), so the static fetch captures only the navigation shell (4,494 tokens vs 28,523 for the full raw document). The actual guide text never appears in the HTML body.

### Why read_url_content behaves this way

The tool does not run a browser fallback or perform main-content extraction (like Readability/Turndown). It retrieves the HTTP response body and writes it directly to disk. For Single Page Applications, this results in missing content; for server-rendered pages, it results in huge, cluttered HTML inputs that flood the model's context window.

## Codex

> **Agent: Codex.** Its native web tool opens the URL as a line-indexed,
> citation-aware text view of the page.

::: info How we measured (tools used)
- **Agent web fetch:** Codex's native web `open` tool. We counted the normalized
  visible text the page view exposes (`≈ chars / 4`), excluding raw HTML scripts
  and styles but including the docs chrome the tool surfaces.
- **Bonsai:** the `@taurgis/bonsai` CLI on **default settings** (`compressed`
  format, `conservative` summary). One fetch produces both cached variants.
- **Raw page:** a plain HTTP GET of the URL.
- **Tokens** are an estimate (`≈ chars / 4`) applied identically to every result,
  so the columns are comparable. Captured **2026-06-25** with `@taurgis/bonsai`
  **v1.0.3**.
:::

### Results

| Page | What Codex web `open` returned | Codex web `open` | Bonsai `compressed` | Bonsai `detailed` | Raw page |
| --- | --- | --: | --: | --: | --: |
| React – `useEffect` | **Line-indexed text:** article text, examples, citations, and docs navigation | 10,101 | **8,119** | 11,296 | 150,883 |
| TypeScript – Everyday Types | **Line-indexed text:** article text plus docs navigation/footer chrome | 7,434 | **4,983** | 6,903 | 80,398 |
| Vue – Introduction | **Line-indexed text:** article text plus navigation; no reusable Markdown artifact | 2,692 | **1,520** | 2,105 | 28,523 |
| Next.js – Layouts and Pages | **Line-indexed text:** article text plus large navigation; page advertises a Markdown source | 3,599 | **2,401** | 2,968 | 246,298 |

### What Codex web `open` left behind

Codex's web tool beats a raw HTML dump: it exposes readable page text instead of
scripts, inline data, and styles. The tradeoff is that the result is still a
one-shot agent view, not a durable research artifact.

- **React, TypeScript, Vue, Next.js: no refusal and no obvious article-level
  loss in this snapshot.** The returned text still includes docs chrome,
  navigation, citation markers, and line-view overhead that Bonsai either strips
  or preserves as structured Markdown.
- **Vue and Next.js:** Bonsai found the public Markdown/MDX source routes and
  cached those deterministic source forms. Codex showed the readable rendered
  page text, but left no reusable cache entry for future agents.
- **Token cost:** on these four pages, Bonsai `compressed` is **20% to 44%
  smaller** than Codex's line view, and it keeps a separate `detailed` version for
  exact technical details.

### Why Codex web `open` behaves this way

The tool is optimized for interactive browsing inside the current conversation.
It can inspect a page, jump to line ranges, and cite sources, which is useful for
answering a live question. It is not a documentation cache:

- **Not persistent.** Another agent or a later session has to fetch and inspect
  the page again.
- **Not deterministic artifact storage.** There is no frontmatter, freshness
  tier, normalized URL hash, content hash, or reusable compressed/detailed pair.
- **Still carries page chrome.** Navigation, footer text, citation markers, and
  line-index scaffolding consume context that Bonsai removes from the cached
  research note.

## Cursor

> **Agent: Cursor.** Its native **`WebFetch`** tool fetches the URL and returns
> the page as readable Markdown. There is **no model in the loop**, so the
> conversion is deterministic, unlike Claude Code's summarizing `WebFetch`.

::: info How we measured (tools used)
- **Agent web fetch:** Cursor's native **`WebFetch`** tool with no extra prompt
  (the tool does not accept a reproduction instruction).
- **Bonsai:** the `@taurgis/bonsai` CLI with **default settings** (`compressed`
  format, `conservative` summary). One fetch produces both cached variants.
- **Raw page:** a plain HTTP GET of the URL.
- **Tokens** are an estimate (`≈ chars / 4`) applied identically to every result,
  so the columns are comparable. Captured **2026-06-25** with `@taurgis/bonsai`
  **v1.0.3**.
:::

### Results

| Page | What WebFetch returned | WebFetch | Bonsai `compressed` | Bonsai `detailed` | Raw page |
| --- | --- | --: | --: | --: | --: |
| React – `useEffect` | **Partial:** article text and code, but Pitfall/Deep-Dive callouts dropped; heading slug noise on every section | 14,442 | **8,119** | 11,296 | 150,883 |
| TypeScript – Everyday Types | **Complete:** full handbook text, but noisy (inline Playground links, mangled fenced-code labels) | 9,087 | **4,983** | 6,903 | 80,398 |
| Vue – Introduction | **Complete:** full guide text from the rendered page (not a refusal) | 2,291 | **1,520** | 2,105 | 28,523 |
| Next.js – Layouts and Pages | **Complete:** pulled Next's published Markdown source | 2,444 | **2,401** | 2,968 | 246,298 |

Read the WebFetch column carefully. Cursor does not summarize like Claude Code,
but the token counts are **not** automatically better. On React and TypeScript,
WebFetch is **28–32% larger** than Bonsai's `detailed` variant while still
dropping structured callouts. On Next.js, WebFetch matches Bonsai's `compressed`
size almost exactly, but only for that one lucky page where Next publishes a
Markdown source.

### What WebFetch left behind

The `detailed` variant preserves the whole article, so measured against that
complete capture, here's what Cursor's fetch missed or added:

::: warning Content missing vs Bonsai's complete capture
- **React – `useEffect`:** Pitfall and Deep-Dive callouts are **absent** even
  though the fetch is *larger* than Bonsai `detailed` (14,442 vs 11,296 tokens).
  The extra tokens are routing-slug suffixes on headings (`{/ reference/}`),
  a trailing Sitemap section, and duplicated scaffolding, not the missing
  callouts.
- **TypeScript – Everyday Types: no major section loss.** Playground URLs and
  inline `Try` affordances are left inline, and several code fences are merged
  with their language tags (`tslet obj: any`).
- **Vue – Introduction: no refusal** (unlike Claude Code) and no empty SPA
  shell (unlike Antigravity's raw HTML). The fetch carries sponsor chrome, a
  rendered `Count is: 0` demo label, and duplicate Options/Composition examples
  that Bonsai's source Markdown collapses.
- **Next.js – Layouts and Pages: no meaningful article loss.** WebFetch found
  Next's published Markdown source, matching Bonsai here. The fetch runs slightly
  shorter than Bonsai `detailed` because footer provenance links are trimmed.

Cursor returned all four pages as readable text, with no copyright refusal, but
only Next.js landed near Bonsai's token budget. React is the cautionary tale:
**more tokens did not mean more documentation**.
:::

### Why WebFetch behaves this way

Cursor's `WebFetch` is a **static HTML-to-Markdown conversion** with no LLM
summarization step. That changes the tradeoffs:

- **Deterministic.** The same URL returns the same Markdown shape every time.
- **Not cached.** Every agent session re-fetches and re-converts; there is no
  reusable artifact with freshness metadata.
- **Extraction gaps.** Without Readability-style main-content tuning or a
  browser fallback, structured callouts (React Pitfall/Deep-Dive) and some
  interactive embeds are dropped while page chrome leaks through.
- **No budget variants.** One blob per fetch. Bonsai's `compressed` and
  `detailed` pair lets agents pick structure-preserving brevity vs exact wording.

### Worked example: React's `useEffect`

What Cursor's `WebFetch` returns with no extra prompt:

```text
WebFetch(url: "https://react.dev/reference/react/useEffect")
→ 14,442 tokens — larger than Bonsai `detailed`, but Pitfall and Deep-Dive
  callouts are missing and every heading carries a slug suffix like {/ usage/}.
```

The same page through Bonsai, with defaults:

```bash
npx @taurgis/bonsai https://react.dev/reference/react/useEffect
npx @taurgis/bonsai inspect https://react.dev/reference/react/useEffect --json
```

```json
{
  "source_url": "https://react.dev/reference/react/useEffect",
  "capture_method": "static_fetch",
  "extraction_status": "extracted",
  "token_estimate": {
    "compressed": 8119,
    "detailed": 11296
  }
}
```

That's 8,119 tokens for the **complete** reference (Pitfall/Deep-Dive included),
cached and reusable, against a 14,442-token fetch that costs more and still drops
structured warnings.

## Mistral Vibe

> **Agent: Mistral Vibe.** Its built-in **`web_fetch`** tool fetches the URL,
> converts the entire HTML page to Markdown, and returns the complete document
> as readable text. There is **no model in the loop** and **no content extraction**.

::: info How we measured (tools used)
- **Agent web fetch:** Mistral Vibe's built-in **`web_fetch`** tool with its
  HTML-to-Markdown conversion. The output is the full page converted verbatim.
- **Bonsai:** the `@taurgis/bonsai` CLI with **default settings** (`compressed`
  format, `conservative` summary). One fetch produces both cached variants.
- **Raw page:** a plain HTTP GET of the URL.
- **Tokens** are an estimate (`≈ chars / 4`) applied identically to every result,
  so the columns are comparable. Captured **2026-06-25** with `@taurgis/bonsai`
  **v1.0.3**. The `web_fetch` output is deterministic (no LLM) but covers the full page.
:::

### Results

| Page | What web_fetch returned | web_fetch | Bonsai `compressed` | Bonsai `detailed` | Raw page |
| --- | --- | --: | --: | --: | --: |
| React – `useEffect` | **Full page:** navigation, sidebar, main content, and footer all converted to Markdown | 41,279 | **8,119** | 11,296 | 604,148 |
| TypeScript – Everyday Types | **Full page:** complete document structure including all navigation and footer | 41,289 | **4,983** | 6,903 | 321,756 |
| Vue – Introduction | **Full page:** entire guide with navigation, sponsor links, language selector | 8,359 | **1,520** | 2,105 | 114,346 |
| Next.js – Layouts and Pages | **Full page:** heavy SPA with extensive navigation and client-side structure | 182,451 | **2,401** | 2,968 | 985,216 |

### What web_fetch left behind

Where other agents summarize or drop content, Mistral Vibe's `web_fetch` converts
**the entire HTML document** to Markdown:

::: warning Page chrome included vs Bonsai's article-only extraction
- **React – `useEffect`: 3.65× more tokens** (41,279 vs 11,296). Full sidebar
  navigation, header, footer, and version links are all preserved.
- **TypeScript – Everyday Types: 5.98× more tokens** (41,289 vs 6,903). The
  complete docs navigation tree and page footer come along.
- **Vue – Introduction: 3.97× more tokens** (8,359 vs 2,105). Sponsor banner,
  language selector, and full navigation remain.
- **Next.js – Layouts and Pages: 61.5× more tokens** (182,451 vs 2,968). The
  SPA's heavy client-side navigation, multiple sidebars, and footer content
  dominate the output.

In every case, `web_fetch` returns more content than Bonsai, but most of that
**extra content is page chrome, not documentation**. Bonsai's extraction
removes 75–95% of the non-article text before conversion.
:::

### Why web_fetch behaves this way

The tool performs a **direct, unfiltered HTML-to-Markdown conversion**:

- **No Readability extraction.** The entire document body is converted, including
  all navigation, sidebars, footers, and decorative page elements.
- **No chrome cleaning.** Unlike Bonsai's `cleanDocsChrome` preprocessing, all
  structural markup becomes Markdown.
- **Deterministic.** The same URL returns the same Markdown shape every time (no
  LLM summarization).
- **Complete but not focused.** You get full page fidelity at significant token
  cost, with no separation between article and chrome.

For SPAs like the Next.js docs, the difference is dramatic. Bonsai finds and
caches the public Markdown source or extracts the rendered article, while `web_fetch`
converts the full client-rendered HTML, including navigation that may exceed the
article word count by an order of magnitude.

### Worked example: React's `useEffect`

What Mistral Vibe's `web_fetch` returns:

```text
web_fetch(url: "https://react.dev/reference/react/useEffect")
→ 41,279 tokens — full page including sidebar navigation,
  React logo, version selector, footer links, and copyright.
```

The same page through Bonsai, with defaults:

```bash
npx @taurgis/bonsai https://react.dev/reference/react/useEffect
npx @taurgis/bonsai inspect https://react.dev/reference/react/useEffect --json
```

```json
{
  "source_url": "https://react.dev/reference/react/useEffect",
  "capture_method": "static_fetch",
  "extraction_status": "extracted",
  "token_estimate": {
    "compressed": 8119,
    "detailed": 11296
  }
}
```

That's 41,279 tokens for the **complete page with chrome** against 11,296 tokens
for Bonsai's **article-only** capture. The difference (29,983 tokens) is
navigation, footers, and structural elements, not documentation content.

## Why Bonsai is different

This part is agent-agnostic. It holds no matter which agent's fetch you compare
against. Bonsai's pipeline is **deterministic: there is no LLM in the loop.** It
extracts the main article, converts it to Markdown, and **always preserves
headings, code, tables, and lists** (see
[Compression & Token Budgeting](/guide/compression)). Then it caches the result
with freshness tiers so the next read is served from disk, no re-fetch and no
model (see [Caching & Freshness](/guide/caching-and-freshness)). Every page is
stored as both a `compressed` and a `detailed` variant, so an agent can pick the
one that fits its budget without losing the structure it reasons over.

## The token angle, honestly

There are two real token costs when an agent reads a page, and Bonsai sits
between them:

- **Dumping the raw page** costs **28k–246k tokens** (the *Raw page* column), and
  most of that is navigation, scripts, and hydration data, not documentation.
- **A lossy web-fetch summary** costs less, but you don't get the whole page.

Bonsai's `compressed` variant gives you the **complete** page for **1.5k–8.1k
tokens**, a **93–99% reduction** versus dumping the raw page, and serves it from
cache on every subsequent call. The `detailed` variant is there verbatim when you
need exact wording.

## More agents

Claude Code, Antigravity, Codex, Cursor, and Mistral Vibe are measured here, each
against the same four pages. More agents can join the same way, by measuring
their built-in fetch tools. Bonsai is the constant: one deterministic, reusable
cache, whichever agent is doing the reading.

## Try it yourself

```bash
# Bonsai, default settings — fetch once, then reuse from cache
npx @taurgis/bonsai https://react.dev/reference/react/useEffect
npx @taurgis/bonsai inspect https://react.dev/reference/react/useEffect --json

# Compare the two cached variants
npx @taurgis/bonsai https://react.dev/reference/react/useEffect --format detailed
npx @taurgis/bonsai https://react.dev/reference/react/useEffect --format compressed
```

Token figures are an estimate (`≈ chars / 4`). Treat them as a consistent
yardstick, not a billing count. Agent web-fetch results depend on the model and
prompt, so they will differ from the snapshot above.
