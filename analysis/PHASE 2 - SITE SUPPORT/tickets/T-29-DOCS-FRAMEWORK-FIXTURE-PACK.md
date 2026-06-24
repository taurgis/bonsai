# T-29: Add Representative Fixtures for Popular Docs Frameworks

## Goal

Create a small deterministic fixture pack for the documentation framework shapes researched in Phase 2 so parser work is evidence-backed and regression-safe.

## Evidence

The framework analysis covers Docusaurus, VitePress, Starlight, MkDocs, Material for MkDocs, Sphinx, Nextra, Fumadocs, Mintlify, GitBook, ReadMe, Redocly, Docsify, VuePress, Rspress, Docsy, Just the Docs, and a rejected Slate probe.

## Scope

- Add minimal HTML fixtures for each supported detector family.
- Add minimal `llms.txt`, route `.md`, search JSON, and `searchindex.js` fixtures.
- Add negative fixtures for failed probes such as HTML error pages and missing `.md` routes.
- Record evidence level in fixture names or metadata.

## Out of Scope

- Large full-site crawls.
- Live network dependency in unit tests.

## Acceptance Criteria

- Every framework detector ticket has at least one fixture.
- `llms.txt` support includes positive and negative fixtures.
- Search connector support includes MkDocs, Sphinx, and Just the Docs fixtures.
- Next/RSC extraction includes Nextra and Fumadocs fixtures.
- Managed platform cleanup includes Mintlify, GitBook, and ReadMe fixtures.
- Slate remains a negative/revalidation fixture, not a supported detector.

## Validation

```bash
pnpm test -- --run src/lib/research src/sites
pnpm type-check
```
