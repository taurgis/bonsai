# Agent research: Bonsai workflow vs native web search

Do not read these runs as "always use Bonsai." On mainstream documentation — TanStack Query, React Server Components — native web search plus training data often delivered a good first-pass inline answer, sometimes for fewer tokens. The failures clustered on enterprise platforms: docs thin in training data, pages behind JavaScript and cookie walls, fetch tooling that never reached the real article. Native runs there produced empty sessions, mirror content, or copy-paste answers with production-breaking mistakes.

Bonsai's win in that territory is **verified official capture on disk**, backed by [site modules](/reference/site-modules) for hosts like Salesforce Help and Developer that need custom extraction. The clearest example in this set is [Scenario 2: enterprise SFCC](#scenario-2-salesforce-b2c-commerce-chunk-oriented-job-step).

Each row below is a **full research session**: find official docs, check current behavior, write something you can ship.

We ran the same three prompts twice in each agent — **Codex**, **Cursor**,
**Antigravity**, and **Claude Code** — in isolated test workspaces with the Bonsai
agent kit installed:

1. **Bonsai workflow** — follow the `web-research` skill: discover URLs if needed,
   capture official pages through `npx @taurgis/bonsai`, then synthesize from
   stored artifacts.
2. **Native web search** — use the agent's built-in web search / fetch only. No
   Bonsai captures, no durable cache artifacts.

Captured **2026-06-29**. Cost metrics differ by agent and are **not directly
comparable across agents**:

| Agent | Metric reported |
| --- | --- |
| Codex | Session **total tokens** (`input + output`, including reasoning) |
| Cursor | **Tokens used** (session total; subagent totals when used) |
| Antigravity | **Context used** (% of context window at session end) |
| Claude Code | **Tokens used** (session total; subagent totals reported separately when used) |

::: info How to read these numbers
- Treat each metric as a **within-agent** yardstick, not a cross-agent billing
  comparison.
- **Subagent totals** (Claude Code) can make a Bonsai workflow look expensive
  even when the chat answer is short — check whether delegation was necessary.
- **Prompt parity was not perfect** in every run (called out below). A harder
  prompt ("Do deep research") can trigger heavier tooling on the native side
  without changing the Bonsai workflow much.
- **Quality** is judged on official-source grounding, technical accuracy, and
  whether the response is actionable without opening side files or rerunning
  failed workflows.
:::

## Summary

### Codex

| Prompt | Approach | Total tokens | Output | Wall time | Outcome |
| --- | --- | --: | --: | --- | --- |
| TanStack Query `useQuery` best practices (React 19) | Bonsai workflow | **134,064** | 6,055 | 2m 38s | Deep, multi-doc synthesis with migration/SSR/Suspense edge cases |
| TanStack Query `useQuery` best practices (React 19) | Native web search | 108,300 | 3,418 | 1m 36s | Solid overview, fewer verified surfaces |
| SFCC custom job step with batching/chunking | Bonsai workflow | 73,997 | 3,066 | 1m 29s | Complete `steptypes.json` + cartridge example from official guide |
| SFCC custom job step with batching/chunking | Native web search | 79,888 | 4,673 | — | **No usable answer** — ~80k tokens, official page not found |
| How React Server Components work (latest React) | Bonsai workflow | **48,979** | 1,830 | 45s | Clear model + code from official React RSC docs |
| How React Server Components work (latest React) | Native web search | 54,025 | 2,070 | 1m 03s | Comparable explanation, slightly longer and costlier |

### Cursor

Captured **2026-06-29** in the `bonsai-test` workspace. Every prompt included
**"Do not use ICM"** so long-term memory could not substitute for fresh research.

| Prompt | Approach | Tokens used | Answer delivery | Outcome |
| --- | --- | --: | --- | --- |
| TanStack Query `useQuery` best practices (React 19) | Bonsai workflow | **47,000** | Inline 14-section guide | Six official TanStack pages captured; `queryOptions`, Suspense, SSR |
| TanStack Query `useQuery` best practices (React 19) | Native web search | **31,000** | Inline via WebFetch | **Comparable depth** to Bonsai; TkDodo + official v5 guides; no cache |
| SFCC custom job step with batching/chunking | Bonsai workflow | **30,000** | Inline + subagent | Official Salesforce guide on disk; correct `chunk-script-module-step` |
| SFCC custom job step with batching/chunking | Native web search | **16,000** | Inline guide | **Deployable** `steptypes.json`; cited official URL; mirror WebFetch |
| How React Server Components work (latest React) | Bonsai workflow | **30,000** | Inline guide | Official `react.dev` pages cached; RSC ≠ SSR, `use()`, serialization |
| How React Server Components work (latest React) | Native web search | **5,000** | Inline orientation | WebSearch only — **no `react.dev` fetch trail** |

**Critical read (quality × tokens):** Cursor shows the tradeoff most clearly. TanStack
native at **31k** matched Bonsai at **47k** on inline usefulness. You paid extra for
**disk cache**, not clearly better prose. SFCC native at **16k** was half the Bonsai
cost with a copy-paste-safe chunk step; Bonsai still won on **provenance** (official
Salesforce capture, not a third-party mirror). On RSC, native at **5k** was **6× cheaper**
but skipped a `react.dev` fetch trail; Bonsai at **30k** left reusable artifacts.

### Antigravity

| Prompt | Approach | Context used | Answer delivery | Outcome |
| --- | --- | --: | --- | --- |
| TanStack Query `useQuery` best practices (React 19) | Bonsai workflow | **6.2%** | Inline structured guide | Strong React 19 + v5 coverage from official TanStack pages |
| TanStack Query `useQuery` best practices (React 19) | Native web search | 4.8% | Artifact + follow-up questions | Comprehensive side doc, but deferred the direct answer |
| SFCC custom job step with batching/chunking | Bonsai workflow | 6.1% | Inline guide + official URL | Correct `chunk-script-module-step` example from Salesforce docs |
| SFCC custom job step with batching/chunking | Native web search | **3.4%** | Inline guide | Cheaper in context, but mock data and incorrect status handling |
| How React Server Components work (latest React) | Bonsai workflow | **4.2%** | Inline guide with code | Three official `react.dev` pages captured; practical examples |
| How React Server Components work (latest React) | Native web search | 4.3% | Artifact + offer to continue | Similar depth in a side file; no Bonsai cache left behind |

### Claude Code

| Prompt | Approach | Tokens used | Answer delivery | Outcome |
| --- | --- | --: | --- | --- |
| TanStack Query `useQuery` best practices (React 19) | Bonsai workflow | **42,500** | Inline guide (7 practices + React 19) | Good v5 coverage; lighter research than Codex Bonsai run |
| TanStack Query `useQuery` best practices (React 19) † | Native web search | **83,500** (60k + 23.5k subagent) | Inline after workflow failure | Excellent depth once recovered; workflow burned retries first |
| SFCC custom job step with batching/chunking | Bonsai workflow | **79,600** (44.9k + 34.7k subagent) | Inline + subagent report | Best accuracy; official Salesforce pages via Bonsai |
| SFCC custom job step with batching/chunking | Native web search | **32,500** | Inline guide | Cheapest run, but `steptypes.json` / status-code mistakes |
| How React Server Components work (latest React) | Bonsai workflow | **41,900** | Inline guide; pages cached | Official `react.dev` via Bonsai; strong streaming/`use()` section |
| How React Server Components work (latest React) ‡ | Native web search | **39,700** | Inline via WebFetch | Comparable quality; mix of official + third-party sources; no cache |

† Native prompt included **"Do deep research"**; Bonsai prompt did not — see
scenario notes.

‡ Native run used explicit WebFetch against `react.dev` (second attempt). An
earlier native run without fetch tooling cost 36k tokens and cited no official
pages.

The takeaway is not "Bonsai always wins on cost" or "native always wins on quality."
**Cursor** native research often had the best token-adjusted quality in this set, and
still left **nothing on disk**. Claude Code's TanStack Bonsai run used **half the
tokens** of its native run but delivered less depth. Its SFCC Bonsai run cost **2.4×**
the native run while being the only path with verified official Salesforce docs among
the original three agents. Token meters and answer quality do not move together. Agent
behavior — ICM, subagents, failed workflows, side artifacts — matters as much as the
tool you pick.

## Scenario 1: TanStack Query + React 19

**Prompt:** "What is best practice on using `useQuery` from TanStack in the
latest React version? Do deep research." *(Claude Code Bonsai run omitted "Do
deep research" — a real confound for that pair.)*

### Codex — Bonsai workflow

**Session cost:** 134,064 total tokens (6,055 output). **2m 38s.**

Captured many official TanStack and React pages. Delivered `queryOptions` +
`enabled` + `AbortSignal` example, v5 callback removal, SSR prefetch rules,
Server Action anti-patterns in `queryFn`, and **15 cited official URLs**.

### Codex — Native web search

**Session cost:** 108,300 total tokens (3,418 output). **1m 36s.**

Solid ten-item best-practices list; less depth on v5 migration, React 19
experimental APIs, and dependent-query waterfalls. No full-page captures.

### Cursor — Bonsai workflow

**Tokens used:** 47,000

Delegated to the `web-research` subagent, then captured six official TanStack
guides through `npx @taurgis/bonsai`. Fourteen inline sections: `queryOptions`
factories, `skipToken`, v5 status flags, `useSuspenseQuery` vs `useQuery`, React
19 `experimental_prefetchInRender` + `use()`, Server Action anti-patterns,
SSR `HydrationBoundary`, anti-pattern list, and a decision flowchart.

**Quality:** Among the strongest TanStack answers — official pages on disk.

**Cost critique:** **+52% vs Cursor native (31k)** on the same prompt. The
premium buys **capture breadth and reuse**, not a clearly better chat answer.

### Cursor — Native web search

**Tokens used:** 31,000

WebFetched official TanStack v5 guides (query options, defaults, disabling queries,
SSR, query keys, parallel queries) plus TkDodo on keys, status checks, and query
abstractions. Fourteen sections with production checklist and anti-pattern table.

**Quality:** **Inline depth matches the Bonsai run** — `queryOptions`, `skipToken`,
Server Actions warning, SSR hydration. Maintainer blogs supplement official docs.

**Cost critique:** **Best token efficiency in the Cursor TanStack pair.** Nothing
written to `.bonsai/research/`; the next agent must re-fetch to inspect sources.

### Antigravity — Bonsai workflow

**Context used:** 6.2%

Five TanStack pages via Bonsai plus targeted web searches. Complete inline guide
(`useSuspenseQuery`, `use(promise)`, Actions, SSR/RSC). Cache entries on disk.

### Antigravity — Native web search

**Context used:** 4.8%

Built a long brain artifact with Mermaid diagrams; chat response was a summary
plus follow-up questions. Depth lived outside the conversation.

### Claude Code — Bonsai workflow

**Tokens used:** 42,500

Fetched at least the official Suspense guide through Bonsai; answered inline with
seven core practices and a React 19 section (`useSuspenseQuery`, experimental
`useQuery().promise`, SSR streaming). **Cheaper than every other Bonsai run in
this scenario** — but did not match Codex's breadth (no `queryOptions` factory
walkthrough, fewer captured pages).

### Claude Code — Native web search

**Tokens used:** 60,000 (main) + 23,500 (subagent) ≈ **83,500**

The bundled `deep-research` workflow **failed** in its scoping phase (structured
output retries exhausted). Claude recovered manually via WebFetch and produced
an excellent inline report: `queryOptions` API, React 19 suspense waterfalls,
`useSuspenseQueries`, SSR `staleTime` trap, anti-patterns, v4→v5 cheat sheet,
and maintainer (TkDodo) sources.

**Critical read:** Native looked like the quality winner **after paying ~2× the
tokens and surviving a workflow failure**. The extra prompt words ("Do deep
research") likely triggered the heavier — and broken — path.

### What all four agents show

| Agent | Bonsai workflow | Native web search |
| --- | --- | --- |
| Codex | 134k tokens (+24% vs its native run) — **deepest Bonsai answer** in this benchmark | 108k tokens — solid inline guide, fewer verified surfaces |
| Cursor | 47k tokens (+52% vs its native run) — **cached official TanStack pages** | 31k tokens — **inline depth matches Bonsai**; no disk cache |
| Antigravity | 6.2% context (+29%) — full inline guide + cached TanStack pages | 4.8% — chat summary only; real depth in a side artifact |
| Claude Code | 42.5k tokens (**−49%** vs its native run) — **cheapest** useful Bonsai run; lighter than Codex | 83.5k — **deepest overall** after a failed workflow and manual WebFetch recovery |

All Bonsai runs left official pages on disk; no native run did. On TanStack,
**Cursor is the scenario where native quality caught up** — Bonsai's value is
reuse, not a dramatically better first answer.

## Scenario 2: Salesforce B2C Commerce chunk-oriented job step

**Prompt:** "How do I write a custom job step in Salesforce B2C Commerce Cloud
using batching/chunking?" *(Same prompt across agents for this scenario.)*

### Codex — Bonsai workflow

**Session cost:** 73,997 tokens (3,066 output). **1m 29s.**

Official guide captured; correct `chunk-script-module-step` cartridge example.

### Codex — Native web search

**Session cost:** 79,888 tokens (4,673 output). **No usable answer** in the saved
transcript despite higher spend than Bonsai.

### Cursor — Bonsai workflow

**Tokens used:** 30,000

Used the `web-research` subagent; captured the official B2C Commerce custom job
steps guide. Inline answer with correct `chunk-script-module-step` lifecycle,
`steptypes.json` at cartridge root, `ProductMgr.queryAllSiteProducts()` example,
and explicit "chunk steps only exit OK or ERROR" rule.

**Quality:** Deployable and officially grounded — pages on disk for reuse.

**Cost critique:** **+88% vs Cursor native (16k)**. You pay for **official
capture**, not a clearly safer answer than native produced in this run.

### Cursor — Native web search

**Tokens used:** 16,000

WebSearch plus WebFetch (including a third-party SFCC mirror). Delivered correct
`steptypes.json` shape (`parameter` array, numeric `chunk-size`), boolean
`afterStep(success, …)`, `Transaction.wrap` in `write`, and cited the official
Salesforce developer guide URL in prose.

**Quality:** **Best cost-adjusted SFCC answer in the benchmark** among native
runs — deployable without the schema bugs seen in Claude or Antigravity native.

**Cost critique:** **Half the Bonsai tokens** with comparable practical utility.
Weakness: no durable official page capture; mirror content may drift from
`developer.salesforce.com`.

### Antigravity — Bonsai workflow

**Context used:** 6.1%

Official Salesforce URL cited; `ProductMgr.queryAllSiteProducts()` example;
reusable cache entry.

### Antigravity — Native web search

**Context used:** 3.4%

Right step type, but mock string-array data and invalid custom `Status` returns
from `afterStep`.

### Claude Code — Bonsai workflow

**Tokens used:** 44,900 + 34,700 (subagent) ≈ **79,600**

Delegated to a docs-researcher subagent that fetched and cached three official
Salesforce surfaces through Bonsai. Chat answer is the strongest in the whole
benchmark: lifecycle diagram, per-chunk transactions, `steptypes.json` field
reference, and explicit "chunk steps only exit OK or ERROR" warning.

**Critical read:** Highest-quality SFCC answer, but **not cheap** — subagent
overhead made it cost more than Claude native and roughly matched Codex native's
failed run.

### Claude Code — Native web search

**Tokens used:** 32,500

Confident inline guide with real `ProductMgr` APIs and per-chunk
`Transaction.begin/commit` in `write`. Problems that would break in BM:

- `afterStep` returns `new Status(Status.OK, 'FINISHED', …)` — chunk steps cannot
  return custom exit codes.
- `parameters` block nested as `"parameters": { "parameters": [...] }` instead
  of `"parameter": [...]`.
- `"chunk-size": "100"` as a string (should be numeric in JSON).

**Critical read:** **Lowest token cost of any SFCC run**, and more deployable
than Antigravity native — but still not copy-paste safe without fixes. Bonsai
workflow was the only path that both **found official docs** and **got the
status model right**.

### What all four agents show

| Agent | Bonsai | Native |
| --- | --- | --- |
| Codex | 74k tokens, correct official example | 80k tokens, **no answer** |
| Cursor | 30k tokens, official capture on disk | **16k tokens, deployable** — cheapest accurate native path |
| Antigravity | 6.1% context, correct | 3.4% context, plausible but wrong |
| Claude Code | 80k tokens (incl. subagent), **best accuracy** | 32.5k tokens, schema errors |

B2C Commerce is the scenario where **token count misleads most**. Native can be
cheap and wrong (Antigravity), expensive and empty (Codex), schema-buggy (Claude),
or **cheap and deployable (Cursor)**. Bonsai still wins when you need **verified
official artifacts** on disk.

## Scenario 3: React Server Components in the latest React

**Prompt:** "How do server-side components work in the latest react version?"
*(Claude native WebFetch run added "Research online how this works in the latest
versions".)*

### Codex — Bonsai workflow

**Session cost:** 48,979 tokens (1,830 output). **45s.**

Four `react.dev` pages captured. Correct RSC ≠ SSR framing.

### Codex — Native web search

**Session cost:** 54,025 tokens (2,070 output). **1m 03s.**

Comparable seven-point answer; no cache artifacts.

### Cursor — Bonsai workflow

**Tokens used:** 30,000

Captured official `react.dev` Server Components and React 19 release notes via
Bonsai. Inline guide: RSC ≠ SSR, async server components, no RSC directive,
`use()` + Suspense streaming, serialization rules, React 19.2 stability caveat.

**Quality:** Strong official grounding with reusable cache entries.

**Cost critique:** **6× Cursor native (5k)**. Worth it when the next agent needs
`bonsai inspect` on `react.dev`; expensive for a one-off orientation.

### Cursor — Native web search

**Tokens used:** 5,000

WebSearch-driven overview: server/client boundary, `'use client'`, composition
rules, async components, serialization pitfalls, framework caveats. No visible
`react.dev` WebFetch trail in the transcript.

**Quality:** **Good mental model, weak provenance** — fine if you will verify
yourself; not a substitute for captured official pages.

**Cost critique:** **Cheapest run in the whole benchmark** for this prompt. You
trade source transparency and reuse for speed.

### Antigravity — Bonsai workflow

**Context used:** 4.2%

Three official pages via Bonsai; inline guide with `Expandable` children pattern.

### Antigravity — Native web search

**Context used:** 4.3%

Strong artifact in brain directory; chat deferred to the file.

### Claude Code — Bonsai workflow

**Tokens used:** 41,900

Used `/web-research` skill; fetched official Server Components material through
Bonsai. Inline answer covering build-time vs request-time, async components, no
RSC directive, `use()` + Suspense streaming, and the React 19.2 stability note.
Explicitly noted pages are cached for future agents.

### Claude Code — Native web search

**Tokens used:** 39,700 (WebFetch run)

Fetched `react.dev` directly. Thorough inline guide with comparison table, Server
Actions / `useActionState` section, and framework caveat. Also cited DebugBear
and Vercel — fine for orientation, but not a substitute for cached official
artifacts.

An earlier native attempt (**36,000 tokens**) answered without a visible
official fetch trail — similar structure, less source transparency.

### What all four agents show

When docs are easy to find, **cost is often a wash** for agents that WebFetch
official pages — and **quality converges** on inline depth:

- Codex: Bonsai slightly cheaper and faster.
- Cursor: **native 6× cheaper (5k vs 30k)** but thinner on official sources.
- Antigravity: identical context (4.2% vs 4.3%).
- Claude Code: native slightly cheaper (39.7k vs 41.9k) with comparable inline
  depth when WebFetch is used.

The remaining difference is **reuse**: only Bonsai runs left durable `react.dev`
cache entries. Native depth in Antigravity's brain folder does not help the next
agent in another tool.

## Interpreting cost honestly

### Research breadth vs research overhead

Capturing more official pages helps accuracy (SFCC, deep TanStack) but is not the
only thing that inflates cost. Claude's SFCC Bonsai run spent **34.7k subagent
tokens** on top of a good chat answer. Codex's TanStack Bonsai run spent **301k
cached input tokens** inside the session. Overhead is not always waste, but it is
not the same as "more documentation in the answer."

### Answer delivery

Antigravity native runs often wrote brain artifacts while the chat stayed short.
Claude's TanStack native run failed a workflow, then recovered. Judge **what the
user would have read in the thread**, not just the meter at the bottom.

### When native is cheaper but worse

Antigravity SFCC (3.4% context, wrong details) and Codex SFCC (80k tokens, no
answer) are the extremes. Claude SFCC native (32.5k, fixable schema bugs) and
**Cursor SFCC native (16k, deployable via mirror)** sit in the middle — tempting
if you do not need official pages on disk.

### Reuse

Bonsai's disk cache survives across sessions and agents. Pages captured in these
runs are available via `bonsai list`, `inspect`, or another `bonsai <url>` fetch
without re-scraping.

## When each approach makes sense

**Native web search fits when:**

- The question is narrow and official docs show up in search results.
- You want a quick read and will verify the risky details yourself.
- You will not revisit the topic or hand the research to another agent.

**The Bonsai workflow fits when:**

- Official docs are hard to find or hard to fetch (enterprise platforms, SPA-heavy sites).
- You need answers tied to **captured** official pages, not search snippets.
- You want cache entries a teammate or a later session can reuse.
- Correctness beats minimizing tokens on the first pass.

**Pause when:**

- A native run is cheap but never cites an official URL.
- A Bonsai run spawns a subagent for work one or two `bonsai <url>` calls could cover.
- The prompts were not matched ("Do deep research" pulls heavier native tooling).

## Reproduce the tests

Tests live in local workspaces (`bonsai-test` for Codex, Cursor, and
Antigravity; `bonsai-test-2` for Claude Code) with the Bonsai agent kit
installed. See [Install the agent kit](/how-to/agent-kit) for the full walkthrough.

```bash
# 1. Make sure the Bonsai CLI runs (Node.js 22+)
npx @taurgis/bonsai --help

# 2. Install the web-research skill, instruction, and subagent for your agent
npx forward-nexus add https://github.com/taurgis/bonsai/tree/main/agents \
  --all --agent=claude-code
# Also: --agent=codex, --agent=antigravity, --agent=cursor, etc.

# 3. Fetch an official page into the local cache
npx @taurgis/bonsai \
  https://tanstack.com/query/latest/docs/framework/react/reference/useQuery \
  --format detailed --json

# 4. Inspect metadata or list what you have cached
npx @taurgis/bonsai inspect \
  https://tanstack.com/query/latest/docs/framework/react/reference/useQuery \
  --json
npx @taurgis/bonsai list --url "*tanstack.com*" --json
```

For the native baseline, ask your agent the same prompt but instruct it to use
only built-in web search or fetch — no `bonsai` commands.

## Related reading

- [Drive Bonsai from an agent](/how-to/agent-integration) — cache-first lookup,
  JSON envelopes, and `--format compressed|detailed`.
- [Install the agent kit](/how-to/agent-kit) — skills, subagents, and hook
  examples that steer agents toward Bonsai instead of one-off fetches.
- [Site modules](/reference/site-modules) — custom capture for client-rendered
  enterprise documentation hosts.
