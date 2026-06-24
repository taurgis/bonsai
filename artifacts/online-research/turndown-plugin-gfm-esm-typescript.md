---
topic: turndown-plugin-gfm ESM TypeScript usage tables rule precedence caveats
slug: turndown-plugin-gfm-esm-typescript
tier: standard
sources:
  - https://registry.npmjs.org/turndown-plugin-gfm/latest
  - https://registry.npmjs.org/turndown-plugin-gfm
  - https://unpkg.com/turndown-plugin-gfm@1.0.2/lib/turndown-plugin-gfm.es.js
  - https://github.com/mixmark-io/turndown-plugin-gfm
  - https://github.com/mixmark-io/turndown/blob/master/src/rules.js
  - https://github.com/mixmark-io/turndown/blob/master/src/commonmark-rules.js
  - https://github.com/mixmark-io/turndown-plugin-gfm/issues/3
fetched_at: 2026-06-24T10:00:00Z
validated_at: 2026-06-24T10:00:00Z
source_version: turndown-plugin-gfm 1.0.2 / turndown 7.x
status: active
---

# turndown-plugin-gfm: ESM, TypeScript, Rule Precedence, and GFM Table Caveats

## 1. Package Version and TypeScript Types

- **npm package name**: `turndown-plugin-gfm`
- **Latest published version**: `1.0.2` (published May 11, 2018; last npm record touch May 22, 2022)
- **Package is unmaintained**: issue #28 on the GitHub repo notes lack of active maintenance.
- **TypeScript types**: none included. No `types` or `typings` field in `package.json`. No `@types/turndown-plugin-gfm` package exists on DefinitelyTyped (404 from npm registry). A `declare module` shim is required.

### Minimal `declare module` shim

```typescript
// turndown-plugin-gfm.d.ts
declare module 'turndown-plugin-gfm' {
  import TurndownService from 'turndown';
  type Plugin = (service: TurndownService) => void;
  export const tables: Plugin;
  export const strikethrough: Plugin;
  export const taskListItems: Plugin;
  export const highlightedCodeBlock: Plugin;
  export const gfm: Plugin;
}
```

## 2. ESM Import and Selective tables-only Usage

The package ships two builds:
- **CJS**: `lib/turndown-plugin-gfm.cjs.js` (the `main` field)
- **ES module**: `lib/turndown-plugin-gfm.es.js` (the `module` / `jsnext:main` field)

The ES module file ends with:
```javascript
export { gfm, highlightedCodeBlock, strikethrough, tables, taskListItems };
```

All five are **named exports** — there is no default export.

### Canonical ESM snippet (tables only)

```typescript
import TurndownService from 'turndown';
import { tables } from 'turndown-plugin-gfm';

const td = new TurndownService();
td.use(tables);                     // registers only the table rules
// td.use(strikethrough)            // opt in separately if needed
// td.use(taskListItems)            // opt in separately if needed

const md = td.turndown('<table>…</table>');
```

Note: because the package has no `exports` map, bundlers/TypeScript resolve it via the `module` field (ES build) or `main` field (CJS). In a pure Node ESM project you may need `"moduleResolution": "bundler"` or `"node16"` in `tsconfig.json`, or use a dynamic `import()`. With `"moduleResolution": "node"` (classic), Node will use the `main` CJS field and you get CommonJS interop.

## 3. Rule Precedence

Source: `turndown/src/rules.js` — the `Rules` class `add()` method uses `unshift()`, prepending to the internal array. The `forNode()` lookup iterates this array first.

**Precedence order** (highest to lowest):
1. Blank rule (node is blank/whitespace-only)
2. **User-added rules via `addRule()` / plugins** — checked first, most recently added wins
3. Keep rules (via `keepReplacement`)
4. Remove rules
5. Default rule (fallback)

CommonMark built-in rules are loaded at initialization into `this.array` — user rules added afterward via `unshift()` slot in **above** them. So a plugin rule for `tableCell` will always win over any hypothetical built-in with the same filter.

**Replacement return values**: emitted verbatim. Turndown's `escape()` function runs only on raw **text nodes** (nodeType === 3) before they reach a replacement function. The string returned by a `replacement()` callback is joined directly into the output without further escaping. This means:
- Markdown characters in replacement output are not double-escaped.
- But it also means the plugin bears full responsibility for safe output.

## 4. Known Caveats for GFM Table Output

### Pipe characters in cell content
The `cell()` helper does **not** escape pipe characters. If a cell's text content contains `|`, the emitted markdown will have unbalanced pipes and the table will render incorrectly in most GFM parsers. Workaround: post-process with a custom `escape` override or a pre-processing step that replaces `|` with `&#124;` or `\|` before conversion.

### Newlines in cells
The table rule only does a single `content.replace('\n\n', '\n')` — it removes one level of blank-line doubling but does not strip all embedded newlines from cell content. A cell containing a block element (e.g., a `<div>` or `<p>`) that produces a newline during conversion will break the pipe-table row onto multiple lines (confirmed by issue #3). Workaround: normalize cell content to a single line before returning from a custom `tableCell` rule, or strip newlines from cell content in a post-step.

### Empty header cells
`isHeadingRow()` uses `Array.prototype.every()` on the list of child `<th>` nodes. An empty row (zero cells) trivially satisfies `every()` and may be misidentified as a heading row. An empty non-TH row that is the first row of `<tbody>` will NOT be treated as a heading, so the whole table is kept as raw HTML (via `turndownService.keep()`).

### Tables without a heading row
Tables with no valid heading row are **kept as raw HTML** by design (the `keep()` call in `tables()`). GFM pipe tables require a header + separator row, so this is intentional — but it means output will contain inline HTML rather than Markdown.

### `replace('\n\n', '\n')` is not global
The `String.prototype.replace` call with a string (not regex) only replaces the **first** occurrence. A table with multiple blank-line-producing cells may still emit extra blank lines. Use `/\n\n/g` as a regex if you patch this.
