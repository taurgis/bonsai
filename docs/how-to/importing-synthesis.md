# Importing Synthesis

Bonsai is not only for pages it fetched. The `import` command stores an agent's
own Markdown in the same cache as everything else, and a later session looks it
up exactly like a fetched page. That text might be a synthesis stitched from
several sources, a cleaned-up extract, or notes from a page behind a login.

This closes a useful loop. An agent reads four pages, reasons over them, writes a
tight summary, and imports it under a topic. A week later, a different agent
searches that topic and gets the finished synthesis back for a few hundred
tokens, with the original sources still attached.

## When to import

Reach for `import` when the content is worth keeping but a plain fetch can't
produce it:

- **Synthesized notes** an agent assembled from several pages.
- **Private or auth-gated docs** the fetcher cannot reach on its own.
- **Manually extracted pages** where you already have clean Markdown and don't
  want Bonsai to re-derive it.

## Two shapes of import

How you import depends on whether the note belongs to a single page or to a set
of sources.

### A note for one URL

Give `import` a single URL and pipe in the Markdown. Bonsai stores it as a
`source` artifact, keyed by that URL's normalized form:

```bash
echo "# Node URL API: field notes" | \
  npx @taurgis/bonsai import https://nodejs.org/api/url.html --stdin
```

Because the cache key matches what a fetch of that URL would use, a later
`bonsai https://nodejs.org/api/url.html` serves your imported note straight from
the cache while it is still fresh. `list` can find it too.

### A synthesis from many sources

When the note draws on several pages, list each one with `--source-url` and give
the note a `--topic`. Bonsai stores it as a `research_note`, keyed by a hash of
the topic and the sorted source URLs:

```bash
cat synthesis.md | npx @taurgis/bonsai import --stdin \
  --topic "React data fetching" \
  --source-url https://react.dev/reference/react/useEffect \
  --source-url https://tanstack.com/query/latest
```

`--topic` is required here. A synthesis has no single URL to fetch, so the topic
and tags are how you find it again. Retrieve it with
[`list`](/reference/commands#list), filtering by `--topic` or `--artifact-type research_note`.

## Giving Bonsai the text

Content comes from one of two places, and you pick exactly one:

- `--stdin` reads piped input, up to 1 MiB.
- `--file <path>` reads a local Markdown file, also capped at 1 MiB.

Empty input is rejected, so a failed upstream step can't quietly cache a blank
note.

## Format and compression

`--input-format` tells Bonsai what you handed it. The default is `detailed`.

A `detailed` import is condensed into a `compressed` variant using the same
policy as a fetch (a structural pass that keeps headings, code, tables, and
lists, with an extractive fallback), so the imported note gets both reading
densities like any cached page. A `compressed` import is trusted as-is and
stored without further trimming.

## Metadata, freshness, and lookup

An imported artifact is tagged with its origin. Its capture method is
`agent_supplied`, its extraction status is `agent_supplied`, and it has no
`fetchedAt` time because nothing was fetched. The usual freshness controls still
apply: `--tier` and `--ttl` set when the note goes stale, and `--topic` plus
`--tags` feed metadata and list filters.

::: tip A synthesis ages by the clock, not the source
There is no remote page to revalidate an imported note against, so it simply
expires on its tier or TTL. Choose a `--tier` (or a `--ttl`) that matches how
long the synthesis stays true.
:::

## Storage and secrets

`--storage` overrides where the note lands for this one import, `global` or
`project`. One rule is not negotiable: a note that contains a detected secret is
always written to the global cache and never to a committable project cache. See
[Storage Modes](/concepts/storage-modes) for the project-versus-global split and
[Troubleshooting & Limits](/troubleshooting) for how secret detection routes a
write.

## In an agent loop

The import step is what makes research compound instead of repeat. A typical
flow:

```bash
# 1. The agent fetches and reasons over several pages, then writes synthesis.md
# 2. It caches the result, source-cited, for every later session:
cat synthesis.md | npx @taurgis/bonsai import --stdin \
  --topic "OAuth device flow" \
  --tags auth --tags oauth \
  --source-url https://example.com/oauth/device \
  --source-url https://www.rfc-editor.org/rfc/rfc8628

# 3. Later, any agent retrieves it with list filters:
npx @taurgis/bonsai list --topic "OAuth device flow" --artifact-type research_note
```

For where this fits in a fuller agent workflow, see
[Agent Integration](/how-to/agent-integration).
