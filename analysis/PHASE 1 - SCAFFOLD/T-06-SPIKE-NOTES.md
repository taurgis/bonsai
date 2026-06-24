# T-06: Extraction Dependency Spike Notes

## Chosen DOM Library
We have chosen **`linkedom`** as our primary DOM parser library. It integrates seamlessly with `@mozilla/readability` and passes all document extraction, boilerplate pruning, relative link/code-block parsing, and malformed HTML checks.
* *Why not `jsdom`?* While `jsdom` is also fully compatible, it has a massive footprint (30+ transitive dependencies, including complex HTTP clients and WebSocket packages) and high resource usage. `linkedom` is lightweight, holds a minimal footprint, and is specifically optimized for server-side HTML-to-DOM parsing.

## Chosen Markdown Converter
We have chosen **`turndown`** as the Markdown converter. It is the industry standard for clean HTML-to-Markdown translation, and can be customized with custom rules.

## Dependency Count (Before vs After)
* **Before `linkedom` (baseline workspace production dependencies)**: 5 direct dependencies (`@mozilla/readability`, `@oclif/core`, `jsdom`, `turndown`, `yaml`).
* **After `linkedom`**: 6 direct dependencies (added `linkedom`).
* **Transitive Dependency Overhead**: `linkedom` only introduces 5 small, specific packages (`css-select`, `cssom`, `html-escaper`, `htmlparser2`, `uhyphen`), whereas `jsdom` pulls in over 30+ transitive dependencies.

## Cold `--help` Timing (Before vs After)
* **Before**: `node bin/cli.mjs --help` takes `~110ms`.
* **After**: `node bin/cli.mjs --help` takes `~110ms`.
* *Note*: Adding `linkedom` has zero impact on CLI startup time because oclif uses lazy/deferred imports, ensuring parser code is only loaded when executing active research extraction tasks.

## Reason Not to Copy the Library into the Repo
We should not copy `@mozilla/readability` or `linkedom` directly into the codebase. Both libraries are highly active, complex, and regularly patched for security, DOM specification compliance, and bug fixes. Maintaining inline copies of these libraries would create technical debt, increase lines-of-code overhead, and make dependency auditing/updating extremely labor-intensive.
