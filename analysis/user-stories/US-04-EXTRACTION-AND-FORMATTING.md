# US-04 Extraction and Formatting

## Epic Goal

Raw web content becomes clean, useful Markdown in both detailed and compressed forms.

## US-04.1 Fetch Static HTML

Priority: P0

As an AI coding agent, I want the CLI to fetch static HTML pages, so that common documentation pages can be researched without browser automation.

Acceptance criteria:

- Fetch supports HTTP and HTTPS.
- Fetch has timeout, redirect, and response-size limits.
- Fetch failures return actionable diagnostics.
- Fetch does not store cookies, auth headers, or session data in artifacts.

## US-04.2 Extract Main Content

Priority: P0

As an AI coding agent, I want navigation, cookie banners, sidebars, scripts, and footer noise removed, so that the result focuses on the source's meaningful content.

Acceptance criteria:

- Main-content extraction uses a documented parser such as Readability.
- Script and style content do not appear in the result.
- Relative URL handling is documented and tested.
- Pages with no readerable content fail clearly or return a documented empty result.

## US-04.3 Produce Detailed Markdown

Priority: P0

As an AI coding agent, I want detailed Markdown that preserves source structure, so that I can inspect exact technical details when needed.

Acceptance criteria:

- Headings are preserved.
- Code blocks are fenced.
- Useful links are preserved.
- Useful tables are preserved or degraded predictably.
- The output is deterministic for the same extracted source.

## US-04.4 Produce Compressed Markdown

Priority: P0

As an AI coding agent, I want compressed Markdown, so that I can fit source context into a smaller token budget.

Acceptance criteria:

- Compressed output is materially shorter than detailed output for representative fixtures.
- Compressed output retains key claims, API names, warnings, version constraints, and examples.
- Images and decorative links are removed or simplified.
- Excessive whitespace is collapsed.

## US-04.5 Estimate Token Cost

Priority: P1

As an AI coding agent, I want a token estimate for each representation, so that I can choose which format to load.

Acceptance criteria:

- The artifact stores token estimates for detailed and compressed formats.
- JSON output includes the estimate for the returned format.
- The estimation method is documented as approximate.

## US-04.6 Render JavaScript Pages

Priority: P3

As an AI coding agent, I want an optional rendered-page mode, so that SPA documentation pages can be captured when static HTML is insufficient.

Acceptance criteria:

- Browser rendering is explicitly enabled or triggered by documented heuristics.
- Browser execution has strict time and resource limits.
- Browser mode is tested separately from static fetch.
- Browser mode does not silently become the default for every page.

## US-04.7 Import Agent-Supplied Research

Priority: P2

As an AI coding agent, I want to push cleaned research Markdown into the cache when automatic extraction fails, so that useful research is still stored in the same CLI-compatible format.

Acceptance criteria:

- The import path accepts one or more source URLs.
- Source URLs use the same URL normalization rules as automatic research.
- The CLI accepts Markdown from stdin.
- Imported content is stored as a normal research artifact.
- Artifact metadata marks the capture method as agent-supplied.
- Single-source imported content can be returned later by `forward-nexus research <url>`.
- Multi-source imported content records all source URLs and is identifiable by topic plus source set.
- Import does not fetch source URLs.
