# @taurgis/bonsai

## 3.0.1

### Patch Changes

- 17579ac: Sanitize likely indirect prompt-injection instructions from fetched and imported documentation before presenting cached Markdown to agents.

## 3.0.0

### Major Changes

- 3782d89: Remove the `search` command, including local cache search, `--domain` site search, and `--remote` docs discovery. Agents should discover official URLs with native web/search tools and fetch pages directly through Bonsai. The shipped agent kit templates and docs are updated accordingly.
