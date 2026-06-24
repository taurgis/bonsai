# Docsify

## Sources

- Docs: https://docsify.js.org/
- Research CLI: rendered fetch, medium confidence, detailed token estimate about 412.
- Observed edit link: https://github.com/docsifyjs/docsify/blob/release-v4/docs/README.md

## Organization

Docsify is a client-side documentation renderer. It does not generate static HTML; it loads and parses Markdown in the browser. The rendered capture succeeded, but the cleanest source is the backing Markdown file.

Docsify routes commonly use hash fragments and files such as:

- `README.md`
- `_sidebar.md`
- `_navbar.md`
- Other Markdown files referenced by route fragments

## Search

The docs describe a full-text search plugin, but the local index shape was not proven in this task. Search should remain `signal`.

## Markdown or Source Site

Yes when edit/source links or route mapping are available. The sampled page exposed a GitHub source Markdown link.

## Default Cache Verdict

Not sufficient without rendered fallback or source mapping. Static fetch will often see only the app shell.

## Recommended Work

- Detect Docsify from `window.$docsify`, hash routes, and Docsify app shell markers.
- Prefer source Markdown from edit links or route mapping.
- Use rendered fallback only when source mapping is unavailable.
- Add fixtures for `_sidebar.md` and route-fragment resolution.
