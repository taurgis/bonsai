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

A query term earns points wherever it lands, and the strongest signals sit
closest to what the entry is *about*:

- **Topic** is worth the most. An exact topic match scores 100, a partial match
  60, and a close-but-not-exact (fuzzy) match 40.
- **Tags** come next: 80 for an exact tag, 30 for a partial or fuzzy one.
- **Source URLs, the summary, and the compressed body** all contribute, so a
  term buried in the content still surfaces the page, just lower down.

Multi-word queries get a phrase bonus when the whole phrase appears in the topic,
tags, summary, or body, which rewards entries that match your full intent rather
than one stray word. Fresh entries get a small boost (30 points, or 10 inside the
grace window), so current research outranks a stale copy of the same page. A
section extracted from a larger page edges out its parent for the same query,
because the section is the more precise hit.

One rule decides what disappears: an entry that matches no query term at all
scores zero and never appears in the results.

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
`snippet`, and `score`. The full envelope is documented in the
[Command Reference](/reference/commands).
