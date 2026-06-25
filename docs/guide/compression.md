# Compression & Token Budgeting

Bonsai stores every page in two variants so you can trade detail for tokens
without re-fetching:

- **`compressed`** (default) — trimmed to fit a tight context window.
- **`detailed`** — the full semantic content for when exact wording matters.

Choose one with `--format` (`-f`):

```bash
npx @taurgis/bonsai https://nodejs.org/api/url.html --format detailed
```

Both variants are cached together, and the stored `token_estimate` records the
size of each (`{ compressed, detailed }`) so an agent can pick the variant that
fits its budget.

## What compression does

Compression runs in layers and is **deterministic — there is no LLM in the
loop**:

1. **Structural** — strip images, simplify links, and collapse blank lines.
2. **Extractive** — condense prose by selecting representative sentences, while
   **always preserving headings, code blocks, tables, and lists**. The shape of
   the document survives; only the verbose prose is trimmed.
3. **Safety** — if the compressed result would be invalid or barely smaller than
   the detailed text, Bonsai falls back to a structural-only or detailed result
   rather than emitting something broken.

The guarantee that matters: the parts an agent reasons over most — code, tables,
and structure — are never thrown away.

## Summary aggressiveness

When structural compression alone leaves the `compressed` variant close in size
to `detailed`, the `summary` setting controls how hard the prose is condensed:

| Value | Behavior |
| --- | --- |
| `conservative` (default) | Minimal prose condensing; safest fidelity. |
| `balanced` | Moderate condensing. |
| `aggressive` | Maximum prose condensing for the tightest budgets. |

Set it persistently or per run:

```bash
# Persisted default
npx @taurgis/bonsai config set summary balanced

# Per invocation (environment override)
BONSAI_SUMMARY=aggressive npx @taurgis/bonsai https://example.com/long-guide
```

See [Configuration](/reference/configuration) for precedence rules.

## When to use which

- **`compressed`** for routine research, broad surveys, and anything where the
  agent needs the gist and the structure — the default for a reason.
- **`detailed`** when you need exact API signatures, full prose, or are about to
  quote the source verbatim.
