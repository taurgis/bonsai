# NestJS

## Sources

- Docs: https://docs.nestjs.com/
- Public docs repo: https://github.com/nestjs/docs.nestjs.com

## Organization

NestJS docs are organized by introduction, fundamentals, techniques, security, GraphQL, WebSockets, microservices, CLI, recipes, and FAQ-style sections. The sampled home page links to introduction, philosophy, installation, and alternatives.

## Search

Search appears client-side/custom. Public API status was not confirmed in this task, so Phase 2 should not implement a NestJS search connector without a saved search-config fixture.

## Markdown or Source Site

Likely yes in the public docs repository. Because static extraction failed, source Markdown should be preferred if mapping is simple.

## Default Cache Verdict

Not sufficient without rendered fallback. Static extraction failed with a Readability parse error. Re-running with `--rendered` succeeded with high confidence and produced useful Markdown.

## Recommended Work

- Add automatic rendered fallback.
- Consider a `nestjs` site default of `rendered: true` until source mapping is implemented.
- Add fixtures for static failure and rendered success.
- Investigate source Markdown mapping before writing a custom parser.
