# User Stories

These user stories describe the product outcomes for `forward-nexus research` before implementation tickets are created.

They are intentionally not tickets. A ticket should cite one or more stories here, then add implementation scope, files, tests, and sequencing.

## Story Map

| Epic | Outcome |
| --- | --- |
| [US-01 Delivery Model](US-01-DELIVERY-MODEL.md) | Deliver research as an optional plugin developed in this repository and define host loading boundaries. |
| [US-02 Research Command](US-02-RESEARCH-COMMAND.md) | Agents can request research from a URL through a stable CLI command. |
| [US-03 Cache and Storage](US-03-CACHE-AND-STORAGE.md) | Research artifacts are stored locally, inspectably, and safely. |
| [US-04 Extraction and Formatting](US-04-EXTRACTION-AND-FORMATTING.md) | Raw web pages become useful compressed or detailed Markdown. |
| [US-05 Freshness and Revalidation](US-05-FRESHNESS-AND-REVALIDATION.md) | Cached research is reused while fresh and revalidated when stale. |
| [US-06 Agent Output Contract](US-06-AGENT-OUTPUT-CONTRACT.md) | Agents receive deterministic JSON and clean stdout/stderr behavior. |
| [US-07 Safety and Governance](US-07-SAFETY-AND-GOVERNANCE.md) | The tool handles untrusted web input, storage, and dependencies responsibly. |

## Priority Key

- `P0`: Required before any useful implementation can ship.
- `P1`: Required for a safe first release.
- `P2`: Important follow-up once the core loop works.
- `P3`: Later enhancement.

## Definition of Ready

A user story is ready for ticket creation when it has:

- a clear primary actor
- a user-visible outcome
- acceptance criteria that can be tested
- dependencies or blockers called out
- a priority
- no unresolved product decision hidden inside the implementation

## Suggested MVP Cut

For the first usable release, target:

- US-01.1 delivery model decision
- US-02.1 single URL research command
- US-02.2 URL and flag validation
- US-03.1 deterministic cache key
- US-03.2 artifact write/read
- US-04.1 static HTML extraction
- US-04.2 detailed Markdown
- US-04.3 compressed Markdown
- US-05.1 fresh cache hit
- US-05.2 stale revalidation unchanged
- US-06.1 JSON envelope
- US-06.2 stdout/stderr discipline
- US-07.1 unsafe URL rejection
- US-07.2 bounded fetch

Keep browser rendering, multi-source topic synthesis, and manual cache migration out of the first implementation. Keep host plugin-install support scoped to the minimum needed to link or dogfood this optional plugin.
