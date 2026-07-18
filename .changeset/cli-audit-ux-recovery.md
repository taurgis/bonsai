---
'@taurgis/bonsai': patch
---

Improve CLI recovery UX from the end-to-end audit: unwrap oclif `Parsing --flag` error wrappers, suggest nearest flags/enum values on typos (including truncated freshness values), tip that `list` omits section artifacts, suggest the URL shorthand for `fetch` typos, surface the `--plan` alias in `--read-only` help, and make multi-source `import` return `sourceUrls`/`topic` with null primary URLs instead of empty strings.
