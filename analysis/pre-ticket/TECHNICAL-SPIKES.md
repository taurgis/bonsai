# Technical Spikes Before Tickets

These are small proof points to run before implementation tickets become detailed. Each spike should produce a short note, not a framework.

## Spike 1. DOM Candidate

Question: can `linkedom` support Readability well enough for common docs pages?

Run fixture extraction against:

- static documentation page
- article page with nav/sidebar/footer
- page with relative links
- page with code blocks
- page with tables
- page with malformed but common HTML

Pass if:

- Readability returns a useful title and content for normal docs fixtures
- relative URLs can be resolved correctly
- script execution is not required
- output quality is close enough to `jsdom` on the same fixtures

Fail action: use `jsdom`.

Do not patch around broad DOM incompatibility. That is how a dependency gets recreated badly.

## Spike 2. Minimal Compressed Output

Question: can compressed output be produced without Turndown?

Try:

- Readability `title`
- Readability `excerpt`
- Readability `textContent`
- simple heading/code preservation only if available from the extracted DOM

Pass if:

- output is clearly smaller than detailed Markdown
- important API names and warnings remain
- no page chrome dominates the result

Fail action: use Turndown first, then apply in-repo compression filters.

## Spike 3. Detailed Markdown

Question: is plain Turndown enough?

Use Turndown with:

- `headingStyle: "atx"`
- `codeBlockStyle: "fenced"`
- deterministic link style

Pass if:

- code examples remain readable
- links remain useful
- tables are acceptable or rare in target docs fixtures

Fail action: add one narrow custom rule. Add `turndown-plugin-gfm` only if fixtures prove table support matters.

## Spike 4. Unsafe URL and SSRF Policy

Question: what exactly must URL validation reject?

Decide and test:

- non-HTTP(S) schemes
- usernames/passwords in URLs
- localhost names
- loopback IP ranges
- RFC1918/private IPv4 ranges
- IPv6 loopback and local ranges
- link-local and metadata IPs such as `169.254.169.254`
- redirects from public URLs to blocked targets

Pass if:

- blocked inputs fail before content is fetched
- redirects are re-validated before following
- errors use the existing Forward Nexus usage/failure exit codes

## Spike 5. Cache Atomicity

Question: are temp-file plus rename writes enough?

Simulate:

- two processes refreshing the same cache key
- interrupted write before rename
- corrupt index
- corrupt artifact frontmatter

Pass if:

- a valid old artifact is not destroyed
- the index can be rebuilt
- one complete new artifact wins

Fail action: add a simple per-cache-key lock file. Do not add a locking package unless cross-process behavior cannot be handled locally.

## Spike 6. Package Impact

Question: which dependencies actually cost startup and install size?

Measure in the plugin package branch, then repeat the help checks through a linked or installed `forward-nexus` host when host dogfooding is available:

```bash
pnpm install
pnpm build
pnpm test:contract
pnpm type-check
node bin/cli.mjs --help
node bin/cli.mjs research --help
```

Record:

- added direct dependencies
- added transitive dependencies
- package manager lockfile size change
- cold `--help` time before and after
- cache-hit command time before and after

Pass if:

- the command remains fast on cache hits
- startup impact is visible and acceptable
- every added dependency has a reason this repo should not own the code
