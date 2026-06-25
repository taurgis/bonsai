# Agent web fetch vs Bonsai

Every AI coding agent has a built-in way to read a web page. This page puts that
built-in fetch **head-to-head with Bonsai** on four popular library docs pages,
and measures what each one actually returns.

The headline isn't "Bonsai uses fewer tokens" — it sometimes uses *more*. It's
that **a built-in web fetch quietly drops, summarizes, or refuses content**,
while Bonsai returns the complete page every time, deterministically, and caches
it for reuse.

One section per agent. **Claude Code** and **Antigravity** are documented below; Codex and GitHub Copilot will follow ([see below](#other-agents)).

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

Claude Code and Antigravity are measured here. The same four pages are being run
through the built-in fetch tools of other agents — **Codex** and **GitHub Copilot** —
and each will get its own section above, measured the same way. Bonsai is the constant:
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
