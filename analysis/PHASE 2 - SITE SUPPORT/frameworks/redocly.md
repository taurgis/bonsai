# Redocly

## Sources

- Docs: https://redocly.com/docs/realm
- Tested `llms.txt`: https://redocly.com/docs/llms.txt returned 404.
- Research CLI: static fetch, medium confidence, detailed token estimate about 665.

## Organization

Redocly provides API documentation and developer portal tooling. The sampled page is an overview of Reunite and Realm with static article content, Git content sources, remote content, and project publishing concepts.

## Search

Search/API docs signals exist at the platform level, but no public search endpoint was proven in this task.

## Markdown or Source Site

Not verified. The tested `llms.txt` path returned 404. Redocly projects may still have Git-backed source, but the generic system should not assume public Markdown routes.

## Default Cache Verdict

Partial. Static article content is usable, but API references and portal pages likely need framework-specific handling for OpenAPI navigation and generated operation pages.

## Recommended Work

- Keep Redocly at P2 until a representative API-reference page is captured.
- Do not implement `llms.txt` support for Redocly without a proven endpoint.
- Add OpenAPI portal fixtures before building a connector.
