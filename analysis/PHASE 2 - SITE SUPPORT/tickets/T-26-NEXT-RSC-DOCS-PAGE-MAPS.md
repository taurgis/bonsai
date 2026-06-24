# T-26: Extract Next/RSC Docs Page Maps and Source Hints

## Goal

Parse Next.js App Router and RSC payloads to recover docs page maps, frontmatter, and source-path hints for frameworks such as Nextra, Fumadocs, Mintlify, Tailwind, Prisma, and modern custom docs sites.

## Evidence

- Nextra HTML exposed a page map with routes, titles, frontmatter, timestamps, and `filePath` values such as `app/docs/page.mdx`.
- Fumadocs and Mintlify pages embed compiled MDX/source-like payloads in Next flight data.
- Earlier Phase 2 site analysis found Tailwind and other Next App Router docs where static Readability missed or damaged code structure.

## Scope

- Detect Next App Router flight payloads.
- Extract route/page map structures when present.
- Extract frontmatter/title/description/source-path hints when present.
- Store source paths as hints only unless a repository/raw URL is verified.
- Preserve page map as discovery metadata.

## Out of Scope

- Executing RSC scripts.
- Assuming every file path is publicly fetchable.
- Implementing every managed platform.

## Acceptance Criteria

- Nextra fixture extracts page map routes and `frontMatter.filePath`.
- Fumadocs fixture extracts sidebar/page links and code block line data where available.
- Mintlify fixture detects generator/platform metadata and scoped `llms.txt`.
- Extracted RSC data is parsed as inert text/data, not executed.
- JSON output labels source paths as `hint` until raw source is verified.

## Validation

```bash
pnpm test -- --run src/lib/research src/sites
pnpm type-check
```
