# T-24: Prefer `llms.txt` and Route Markdown When Verified

## Goal

Add a generic machine-readable artifact discovery layer before HTML extraction so documentation sites that publish `llms.txt` or route-level Markdown are captured from the best available source.

## Evidence

- VitePress returned HTTP 200 for `https://vitepress.dev/guide/what-is-vitepress.md`.
- Rspress returned HTTP 200 for `llms.txt` and `guide/start/introduction.md` after redirect to `rspress.rs`.
- GitBook returned HTTP 200 for `https://gitbook.com/docs/llms.txt` and `https://gitbook.com/docs/getting-started/readme.md`.
- Mintlify returned HTTP 200 for `https://mintlify.com/docs/llms.txt`; `https://mintlify.com/docs.md` returned 404.
- Fumadocs returned HTTP 200 for `https://fumadocs.dev/llms.txt`; `https://fumadocs.dev/docs.md` returned 404.
- ReadMe returned HTTP 200 for `https://docs.readme.com/llms.txt` and embeds a hidden AI-agent hint to that file.

## Scope

- Probe conventional and advertised `llms.txt` URLs for docs sites.
- Probe route-level `.md` only for frameworks or pages that advertise it or where a detector says it is likely.
- Store `llms.txt` as a site-index artifact, not as a replacement for page content unless it contains full page content.
- Prefer route-level Markdown or linked page Markdown for detailed page capture when validated.
- Expose artifact source type in JSON and frontmatter.

## Out of Scope

- Trusting every `.md` URL blindly.
- Implementing provider search APIs.
- Replacing exact page artifacts with `llms.txt` summaries.

## Acceptance Criteria

- VitePress fixture prefers route `.md` over HTML.
- Rspress fixture discovers `llms.txt` and route `.md`.
- GitBook fixture discovers `llms.txt` and a linked page Markdown route.
- Mintlify and Fumadocs fixtures store `llms.txt` but do not assume `/docs.md`.
- ReadMe fixture stores `llms.txt` and records platform metadata.
- Probes reject HTML error pages, unrelated origins, empty files, and soft 404 pages.
- JSON output includes stable fields for `artifactType`, `machineReadable.type`, `machineReadable.url`, and validation notes.

## Validation

```bash
pnpm test -- --run src/lib/research src/sites
pnpm type-check
```
