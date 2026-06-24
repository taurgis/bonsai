# US-07 Safety and Governance

## Epic Goal

The research feature handles untrusted web input, local storage, and dependencies with a clear security and maintenance posture.

## US-07.1 Reject Unsafe URLs

Priority: P0

As a maintainer, I want unsafe URL schemes rejected, so that research cannot read local files or execute script-like inputs.

Acceptance criteria:

- Only HTTP and HTTPS are accepted in the first release.
- `file:`, `data:`, `javascript:`, and empty schemes are rejected with exit `2`.
- URL validation happens before any fetch or storage write.
- Tests cover accepted and rejected schemes.

## US-07.2 Bound Fetch Work

Priority: P0

As a maintainer, I want fetches bounded by timeout, redirect, and size limits, so that a bad page cannot hang or exhaust the CLI.

Acceptance criteria:

- Fetch timeout is documented and tested.
- Redirect limit is documented and tested.
- Maximum response size is documented and tested.
- Size or timeout failures preserve existing cache content.

## US-07.3 Avoid Secret Persistence

Priority: P1

As a user, I want the research cache to avoid storing secrets or session-derived data, so that local artifacts do not accidentally archive credentials.

Acceptance criteria:

- Request headers and cookies are not stored in artifacts.
- Authenticated fetch behavior is out of scope unless explicitly designed.
- URLs are normalized with a policy for query strings and fragments.
- Documentation warns users not to research private authenticated pages in v1.

## US-07.4 Sanitize Untrusted HTML

Priority: P1

As a maintainer, I want unsafe HTML removed before storage or rendering, so that stored research is data, not executable content.

Acceptance criteria:

- Script and style content are removed.
- `jsdom` or equivalent does not execute page scripts.
- Stored Markdown is treated as untrusted external content by downstream agents.
- Sanitization behavior is covered by fixtures.

## US-07.5 Review Dependency Footprint

Priority: P1

As a maintainer, I want new dependencies reviewed before implementation, so that install size, startup time, license posture, and maintenance risk are acceptable.

Acceptance criteria:

- Candidate dependencies list runtime size and license.
- Startup impact is measured before and after adding dependencies.
- Browser automation dependencies are separate from the static extraction MVP.
- Dependencies are compatible with Node `>=22` and ESM.

## US-07.6 Respect Source Owners

Priority: P2

As a maintainer, I want the research command to behave politely toward source websites, so that the CLI does not create abusive traffic.

Acceptance criteria:

- User-agent policy is documented.
- Cache hits avoid repeated network calls.
- Revalidation avoids full refetch when possible.
- Rate limiting or backoff is considered before any bulk or multi-source feature.

## US-07.7 Document Limitations

Priority: P1

As a user, I want the command's limitations documented, so that I know when not to rely on it.

Acceptance criteria:

- Docs state that v1 is not a crawler.
- Docs state static extraction limitations.
- Docs state browser fallback status.
- Docs state cache freshness is a policy signal, not a guarantee that the source is semantically correct.
