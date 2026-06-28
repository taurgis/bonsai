# Search

Before fetching a page, it pays to check what you already have. `bonsai search`
ranks the local cache by keyword so an agent can find earlier research instead
of paying for the same fetch twice. When the cache comes up empty, the same
command can reach into a documentation site's own search or discover uncached
pages.

## Search the local cache

Pass a query string. Bonsai lowercases it, splits it on whitespace, scores every
active cache entry, and returns the best matches.

```bash
npx @taurgis/bonsai search "react useEffect cleanup"
```

By default you get the top 10 results. Raise or lower that with `--limit` (up to
50). Each result carries its cache key, source URLs, topic, tags, freshness, a
short snippet, and the score that ranked it. Add `--json` for the machine-readable
envelope an agent can parse:

```bash
npx @taurgis/bonsai search "react useEffect cleanup" --json --limit 5
```

## How ranking works

Bonsai parses your query before scoring:

- **Quoted phrases** (`"use effect"`) must appear contiguously in the entry.
- **Unquoted terms** have common English stopwords removed (`how`, `the`, `to`, …).
- **Every remaining term must match** (AND semantics). An entry that only hits
  one word of a multi-word query is excluded.

Matching is **token-aware**, not substring-based: `art` does not match `start`,
and `api` does not match `rapid`. Terms can match exactly, as a **prefix**
(`authent` → `authentication`), or **fuzzily** (typo tolerance scales with term
length).

Scores combine metadata boosts with **BM25-lite** ranking on the summary and
compressed body (rare terms rank higher than words that appear in every note):

- **Topic** is worth the most: exact, prefix, then fuzzy matches.
- **Tags** and **source URLs** come next.
- **Summary and compressed content** contribute via BM25, with summary weighted
  more heavily.

Multi-word queries get an extra bonus when terms appear adjacent in the text.
Quoted phrases earn a field-specific boost depending on where they matched. Fresh
entries get a small boost (30 points, or 10 inside the grace window). A section
extracted from a larger page edges out its parent for the same query, because
the section is the more precise hit.

## Narrow the results

Filters apply before scoring, so they trim the candidate set rather than reorder
it.

| Flag | Effect |
| --- | --- |
| `--topic <name>` | Keep only entries with this exact topic (case-insensitive). |
| `--tags <tag>` | Keep entries that carry **all** the tags you pass (repeatable). |
| `--artifact-type <type>` | Restrict to `source`, `research_note`, `index`, or `section`. |
| `--limit <n>` | Cap the result count (default 10, max 50). |
| `--include-stale` | Include expired entries, which are hidden by default. |

The `research_note` type is worth remembering: it is how a multi-source
synthesis is stored. See [Importing Synthesis](/how-to/importing-synthesis) for
how those entries get into the cache.

## Reach past the cache

Two flags turn `search` from a cache lookup into live discovery.

`--domain` searches a documentation site through its [site module](/reference/site-modules).
The module talks to the site's own search backend (for example, Coveo on
`help.salesforce.com`) and returns real pages you can then fetch:

```bash
npx @taurgis/bonsai search "single sign-on" --domain help.salesforce.com
```

This needs a site module that implements search. Ask for a domain without one,
and the command stops with a clear error rather than quietly scanning the cache.

`--remote` discovers uncached pages through a site's public search or docs index.
Point it at a docs URL and Bonsai picks a connector for that site (Algolia
DocSearch, MkDocs / Sphinx / Just-the-Docs index, llms.txt, or sitemap.xml):

```bash
npx @taurgis/bonsai search "middleware" --remote https://docs.example.com/
```

If no connector fits the URL, remote discovery steps aside and the query falls
back to a normal local cache search, with a warning so you know which path ran.

## Result fields

Local results return as an array. The fields you will use most are `cacheKey`
and `path` (where the artifact lives), `sourceUrls`, `topic`, `tags`,
`freshness`, `tokenEstimate` (separate `compressed` and `detailed` counts),
`snippet`, `score`, and `matchedTerms` (each hit records the query term, which
field matched, and whether the match was `exact`, `prefix`, `fuzzy`, or
`phrase`). The full envelope is documented in the
[Command Reference](/reference/commands).
