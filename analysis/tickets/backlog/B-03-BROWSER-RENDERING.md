# B-03: Add Browser-Rendered Extraction

## Goal

Support pages where static HTML cannot expose meaningful content.

## Scope

- Add explicit `--rendered`.
- Define timeout, resource blocking, user agent, sandboxing, and size limits.
- Keep browser mode separate from static fetch tests.

## Not Before

- Static extraction fails important docs pages often enough to justify Playwright or Puppeteer.
