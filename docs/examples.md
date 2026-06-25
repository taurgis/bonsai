# Agent web fetch vs Bonsai

Every AI coding agent has a built-in way to read a web page. This page puts that
built-in fetch **head-to-head with Bonsai** on four popular library docs pages,
and measures what each one actually returns.

The headline isn't "Bonsai uses fewer tokens" — it sometimes uses *more*. It's
that **a built-in web fetch quietly drops, summarizes, or refuses content**,
while Bonsai returns the complete page every time, deterministically, and caches
it for reuse.

One section per agent. **Claude Code**, **Antigravity**, **Codex**, and **Cursor** are documented below; GitHub Copilot will follow ([see below](#other-agents)).

## Claude Code

> **Agent: Claude Code** — its native **`WebFetch`** tool fetches the URL,
> converts the page to Markdown, and runs a **small, fast model** over it to
> answer a prompt.

::: info How we measured (tools used)
- **Agent web fetch** — Claude Code's native **`WebFetch`** tool. We asked it to
  reproduce the full page verbatim ("do not summarize, omit, or editorialize").
- **Bonsai** — the `@taurgis/bonsai` CLI with **default settings** (`compressed`
  format, `conservative` summary). Both cached variants come from one fetch.
- **Raw page** — a plain HTTP GET of the URL (the bytes you'd paste into context
  if you dumped the fetched page).
- **Tokens** are an estimate (`≈ chars / 4`) applied identically to every result,
  so the columns are comparable. Captured **2026-06-25** with `@taurgis/bonsai`
  **v1.0.3**; a model-backed tool like `WebFetch` is non-deterministic, so your
  figures will vary.
:::

### Results

| Page | What WebFetch returned | WebFetch | Bonsai `compressed` | Bonsai `detailed` | Raw page |
| --- | --- | --: | --: | --: | --: |
| React – `useEffect` | **Partial** — dropped ~37%: interactive sandboxes, multi-file demos, Pitfall/Deep-Dive callouts | 7,150 | **8,119** | 11,296 | 150,883 |
| TypeScript – Everyday Types | **Summarized** — Enums collapsed to one line, examples trimmed | 1,638 | **4,983** | 6,903 | 80,398 |
| Vue – Introduction | **Refused** — declined on copyright grounds; returned a 5-line summary | 337 | **1,520** | 2,105 | 28,523 |
| Next.js – Layouts and Pages | **Complete** — pulled Next's published Markdown source | 3,340 | **2,401** | 2,968 | 246,298 |

Read the WebFetch column carefully: the small numbers are not efficiency, they
are **missing documentation**. For React, 7,150 tokens looks lean until you
notice a third of the page is gone. For Vue, 337 tokens is a refusal.

**The one fair comparison is Next.js** — the only page WebFetch returned in full.
There, Bonsai's `compressed` cache is both **complete and 28% smaller**
(2,401 vs 3,340 tokens), and you can reuse it for free.

### What WebFetch left behind

This is the honest, uncomfortable part. Measured against Bonsai's **complete**
capture — the `detailed` variant preserves the whole article — here's how much of
each page the agent fetch was missing, *despite being asked for everything*:

::: warning Content missing vs Bonsai's complete capture
- **React – `useEffect`** — ≈ **37% missing** (7,150 vs 11,296 tokens): the
  interactive sandboxes, the multi-file chat/api demos, and the Pitfall/Deep-Dive
  callouts.
- **TypeScript – Everyday Types** — ≈ **76% missing** (1,638 vs 6,903): most code
  examples gone and the Enums section collapsed to a single sentence.
- **Vue – Introduction** — ≈ **84% missing** (337 vs 2,105): a refusal, not a page.
- **Next.js – Layouts and Pages** — **no meaningful loss**: WebFetch happened to
  find Next's published Markdown source, so it matched Bonsai here.

Three of four reads silently dropped most of the documentation. Bonsai returned
all four pages in full.
:::

Token delta is a proxy for content loss, but it lines up with the specific
sections each result dropped (listed above), and Bonsai's `detailed` variant is
guarded against content loss by the project's regression suite. The danger isn't
the smaller token count — it's that **the agent never tells you what it left
out.**

### Why WebFetch behaves this way

There's a model in the loop. `WebFetch` fetches the page, converts it to Markdown,
and runs a small fast model to answer your prompt. That has four consequences for
documentation:

- **Lossy** — output is bounded and the model trims to fit, so long pages lose
  content (often the code examples and tables you actually came for).
- **Non-deterministic** — the same URL with a different prompt or model gives a
  different result. You can't pin it.
- **It can refuse** — as Vue did, on copyright grounds.
- **Not reusable** — it's a one-shot answer (cached only minutes). The next agent,
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

8,119 tokens for the **complete** reference, cached and reusable — versus a
7,150-token fetch that silently left a third of the page behind.

## Antigravity

> **Agent: Antigravity** — its native **`read_url_content`** tool fetches the URL
> and saves the raw HTML response body directly into a workspace file.

::: info How we measured (tools used)
- **Agent web fetch** — Antigravity's native **`read_url_content`** tool. We measured
  the character length of the raw output file saved to the workspace (`≈ chars / 4`).
- **Bonsai** — the `@taurgis/bonsai` CLI with **default settings** (`compressed`
  format, `conservative` summary). Both cached variants come from one fetch.
- **Raw page** — a plain HTTP GET of the URL.
- **Tokens** are an estimate (`≈ chars / 4`) applied identically to every result,
  so the columns are comparable. Captured **2026-06-25** with `@taurgis/bonsai`
  **v1.0.3**.
:::

### Results

| Page | What read_url_content returned | read_url_content | Bonsai `compressed` | Bonsai `detailed` | Raw page |
| --- | --- | --: | --: | --: | --: |
| React – `useEffect` | **Raw HTML** — complete raw HTML source containing all scripts/styles | 150,905 | **8,119** | 11,296 | 150,883 |
| TypeScript – Everyday Types | **Raw HTML** — complete raw HTML source containing all scripts/styles | 19,377 | **4,983** | 6,903 | 80,398 |
| Vue – Introduction | **Empty Shell** — returned initial static HTML containing only menus; main content was client-rendered | 4,494 | **1,520** | 2,105 | 28,523 |
| Next.js – Layouts and Pages | **Raw HTML** — complete raw HTML source containing all scripts/styles | 245,393 | **2,401** | 2,968 | 246,298 |

### What read_url_content left behind

Unlike Claude Code's model-backed tool which summarizes or drops sections, Antigravity's `read_url_content` fetches the full page response. However:

- **React, TypeScript, Next.js** — **No content loss, but massive token waste**: The tool returns the raw HTML document verbatim. This wastes **93% to 99%** of the token budget on boilerplate scripts, SVG icons, and inline styles compared to Bonsai's clean Markdown extraction.
- **Vue – Introduction** — **84% content loss**: Because Vue uses client-side rendering (SPA navigation/hydration), the static fetch only captures the navigation shell (4,494 tokens vs 28,523 for the full raw document). The actual guide text is completely missing from the HTML body.

### Why read_url_content behaves this way

The tool does not run a browser fallback or perform main-content extraction (like Readability/Turndown). It retrieves the HTTP response body and writes it directly to disk. For Single Page Applications, this results in missing content; for server-rendered pages, it results in huge, cluttered HTML inputs that flood the model's context window.

## Codex

> **Agent: Codex** — its native web tool opens the URL as a line-indexed,
> citation-aware text view of the page.

::: info How we measured (tools used)
- **Agent web fetch** — Codex's native web `open` tool. We measured the
  normalized visible text exposed by the page view (`≈ chars / 4`), excluding raw
  HTML scripts and styles but including docs chrome that the tool exposes.
- **Bonsai** — the `@taurgis/bonsai` CLI with **default settings** (`compressed`
  format, `conservative` summary). Both cached variants come from one fetch.
- **Raw page** — a plain HTTP GET of the URL.
- **Tokens** are an estimate (`≈ chars / 4`) applied identically to every result,
  so the columns are comparable. Captured **2026-06-25** with `@taurgis/bonsai`
  **v1.0.3**.
:::

### Results

| Page | What Codex web `open` returned | Codex web `open` | Bonsai `compressed` | Bonsai `detailed` | Raw page |
| --- | --- | --: | --: | --: | --: |
| React – `useEffect` | **Line-indexed text** — article text, examples, citations, and docs navigation | 10,101 | **8,119** | 11,296 | 150,883 |
| TypeScript – Everyday Types | **Line-indexed text** — article text plus docs navigation/footer chrome | 7,434 | **4,983** | 6,903 | 80,398 |
| Vue – Introduction | **Line-indexed text** — article text plus navigation; no reusable Markdown artifact | 2,692 | **1,520** | 2,105 | 28,523 |
| Next.js – Layouts and Pages | **Line-indexed text** — article text plus large navigation; page advertises a Markdown source | 3,599 | **2,401** | 2,968 | 246,298 |

### What Codex web `open` left behind

Codex's web tool is much better than a raw HTML dump: it exposes readable page
text instead of scripts, inline data, and styles. The tradeoff is that the result
is still a one-shot agent view, not a durable research artifact:

- **React, TypeScript, Vue, Next.js** — **No refusal and no obvious article-level
  loss in this snapshot**, but the returned text includes docs chrome,
  navigation, citation markers, and line-view overhead that Bonsai strips or
  preserves as structured Markdown.
- **Vue and Next.js** — Bonsai found the public Markdown/MDX source routes and
  cached those deterministic source forms. Codex showed the readable rendered
  page text, but did not create a reusable cache entry for future agents.
- **Token cost** — Bonsai `compressed` is **20% to 44% smaller** than Codex's
  line view on these four pages while keeping a separate `detailed` version for
  exact technical details.

### Why Codex web `open` behaves this way

The tool is optimized for interactive browsing inside the current conversation.
It can inspect a page, jump to line ranges, and cite sources, which is useful for
answering a live question. It is not a documentation cache:

- **Not persistent** — another agent or a later session has to fetch and inspect
  the page again.
- **Not deterministic artifact storage** — there is no frontmatter, freshness
  tier, normalized URL hash, content hash, or reusable compressed/detailed pair.
- **Still carries page chrome** — navigation, footer text, citation markers, and
  line-index scaffolding consume context that Bonsai removes from the cached
  research note.

## Cursor

> **Agent: Cursor** — its native **`WebFetch`** tool fetches the URL and returns
> the page as readable Markdown. There is **no model in the loop** — conversion is
> deterministic, unlike Claude Code's summarizing `WebFetch`.

::: info How we measured (tools used)
- **Agent web fetch** — Cursor's native **`WebFetch`** tool with no extra prompt
  (the tool does not accept a reproduction instruction).
- **Bonsai** — the `@taurgis/bonsai` CLI with **default settings** (`compressed`
  format, `conservative` summary). Both cached variants come from one fetch.
- **Raw page** — a plain HTTP GET of the URL.
- **Tokens** are an estimate (`≈ chars / 4`) applied identically to every result,
  so the columns are comparable. Captured **2026-06-25** with `@taurgis/bonsai`
  **v1.0.3**.
:::

### Results

| Page | What WebFetch returned | WebFetch | Bonsai `compressed` | Bonsai `detailed` | Raw page |
| --- | --- | --: | --: | --: | --: |
| React – `useEffect` | **Partial** — article text and code, but Pitfall/Deep-Dive callouts dropped; heading slug noise on every section | 14,442 | **8,119** | 11,296 | 150,883 |
| TypeScript – Everyday Types | **Complete** — full handbook text, but noisy (inline Playground links, mangled fenced-code labels) | 9,087 | **4,983** | 6,903 | 80,398 |
| Vue – Introduction | **Complete** — full guide text from the rendered page (not a refusal) | 2,291 | **1,520** | 2,105 | 28,523 |
| Next.js – Layouts and Pages | **Complete** — pulled Next's published Markdown source | 2,444 | **2,401** | 2,968 | 246,298 |

Read the WebFetch column carefully: Cursor does not summarize like Claude Code,
but the token counts are **not** automatically better. On React and TypeScript,
WebFetch is **28–32% larger** than Bonsai's `detailed` variant while still
dropping structured callouts. On Next.js, WebFetch matches Bonsai's `compressed`
size almost exactly — but only for that one lucky page where Next publishes a
Markdown source.

### What WebFetch left behind

Measured against Bonsai's **complete** capture — the `detailed` variant preserves
the whole article — here's what Cursor's fetch missed or added:

::: warning Content missing vs Bonsai's complete capture
- **React – `useEffect`** — Pitfall and Deep-Dive callouts are **absent** even
  though the fetch is *larger* than Bonsai `detailed` (14,442 vs 11,296 tokens).
  The extra tokens are routing-slug suffixes on headings (`{/ reference/}`),
  a trailing Sitemap section, and duplicated scaffolding — not the missing
  callouts.
- **TypeScript – Everyday Types** — **no major section loss**, but Playground
  URLs and inline `Try` affordances are left inline, and several code fences are
  merged with their language tags (`tslet obj: any`).
- **Vue – Introduction** — **no refusal** (unlike Claude Code) and no empty SPA
  shell (unlike Antigravity's raw HTML). The fetch includes sponsor chrome, a
  rendered `Count is: 0` demo label, and duplicate Options/Composition examples
  that Bonsai's source Markdown collapses.
- **Next.js – Layouts and Pages** — **no meaningful article loss**: WebFetch found
  Next's published Markdown source, matching Bonsai here. The fetch is slightly
  shorter than Bonsai `detailed` because footer provenance links are trimmed.

Cursor returned all four pages as readable text — no copyright refusal — but only
Next.js landed near Bonsai's token budget. React is the cautionary tale: **more
tokens did not mean more documentation**.
:::

### Why WebFetch behaves this way

Cursor's `WebFetch` is a **static HTML-to-Markdown conversion** with no LLM
summarization step. That changes the tradeoffs:

- **Deterministic** — the same URL returns the same Markdown shape every time.
- **Not cached** — every agent session re-fetches and re-converts; there is no
  reusable artifact with freshness metadata.
- **Extraction gaps** — without Readability-style main-content tuning or a
  browser fallback, structured callouts (React Pitfall/Deep-Dive) and some
  interactive embeds are dropped while page chrome leaks through.
- **No budget variants** — one blob per fetch. Bonsai's `compressed` and
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

8,119 tokens for the **complete** reference (Pitfall/Deep-Dive included), cached
and reusable — versus a 14,442-token fetch that costs more and still drops
structured warnings.

## Why Bonsai is different

This part is agent-agnostic — it's true no matter which agent's fetch you compare
against. Bonsai's pipeline is **deterministic — there is no LLM in the loop**. It
extracts the main article, converts it to Markdown, and **always preserves
headings, code, tables, and lists** (see
[Compression & Token Budgeting](/guide/compression)). Then it caches the result
with freshness tiers so the next read is served from disk, no re-fetch and no
model (see [Caching & Freshness](/guide/caching-and-freshness)). Every page is
stored as both a `compressed` and a `detailed` variant, so an agent can pick the
one that fits its budget — without losing the structure it reasons over.

## The token angle, honestly

There are two real token costs when an agent reads a page, and Bonsai sits
between them:

- **Dumping the raw page** costs **28k–246k tokens** (the *Raw page* column) — and
  most of that is navigation, scripts, and hydration data, not documentation.
- **A lossy web-fetch summary** costs less, but you don't get the whole page.

Bonsai's `compressed` variant gives you the **complete** page for **1.5k–8.1k
tokens** — a **93–99% reduction** versus dumping the raw page — and serves it from
cache on every subsequent call. The `detailed` variant is there verbatim when you
need exact wording.

## Other agents

Claude Code, Antigravity, Codex, and Cursor are measured here. The same four pages
are being run through the built-in fetch tools of other agents — **GitHub Copilot**
will get its own section above, measured the same way. Bonsai is the constant:
one deterministic, reusable cache, whichever agent is doing the reading.

## Try it yourself

```bash
# Bonsai, default settings — fetch once, then reuse from cache
npx @taurgis/bonsai https://react.dev/reference/react/useEffect
npx @taurgis/bonsai inspect https://react.dev/reference/react/useEffect --json

# Compare the two cached variants
npx @taurgis/bonsai https://react.dev/reference/react/useEffect --format detailed
npx @taurgis/bonsai https://react.dev/reference/react/useEffect --format compressed
```

Token figures are an estimate (`≈ chars / 4`); treat them as a consistent
yardstick, not a billing count. Agent web-fetch results depend on the model and
prompt and will differ from the snapshot above.
