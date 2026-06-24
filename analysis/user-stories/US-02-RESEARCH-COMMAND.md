# US-02 Research Command

## Epic Goal

Agents and developers can request research for a URL through a predictable CLI command.

## US-02.1 Research a Single URL

Priority: P0

As an AI coding agent, I want to run `forward-nexus research <url>`, so that I can fetch useful source content without manually scraping and cleaning HTML.

Acceptance criteria:

- The command accepts exactly one required URL argument.
- The command rejects missing URLs with exit `2`.
- The command rejects unsupported URL schemes with exit `2`.
- The command returns extracted content on success.
- The command records the source URL in the artifact metadata.

## US-02.2 Supply Metadata

Priority: P1

As an AI coding agent, I want to pass `--topic` and `--tags`, so that cached research can be grouped and inspected later.

Acceptance criteria:

- `--topic` accepts a string.
- `--tags` supports repeated values.
- Tags are stored as metadata.
- Topic and tags do not create duplicate artifacts for the same normalized URL.

## US-02.3 Choose Output Density

Priority: P0

As an AI coding agent, I want to request `--format compressed` or `--format detailed`, so that I can choose between context efficiency and source fidelity.

Acceptance criteria:

- `--format` accepts only `compressed` or `detailed`.
- Invalid formats exit `2`.
- The default format is documented.
- The selected format is represented in JSON output.
- Both formats come from the same logical cached source artifact unless the delivery design explicitly chooses otherwise.

## US-02.4 Force Refresh

Priority: P1

As a developer, I want to pass `--force`, so that I can refresh a source even when the cache says it is fresh.

Acceptance criteria:

- `--force` bypasses the fresh-hit path.
- The artifact is updated only after a successful fetch and extraction.
- A failed forced refresh does not delete or corrupt the previous artifact.
- JSON output identifies the cache status as refreshed or unavailable.

## US-02.5 Inspect Help

Priority: P1

As a CLI user, I want `forward-nexus research --help` to explain usage, flags, freshness, and output formats, so that I can call the command correctly without reading source code.

Acceptance criteria:

- Help includes usage with `<url>`.
- Help documents `--topic`, `--tags`, `--format`, `--ttl`, `--tier`, `--force`, and `--json` if implemented.
- Help examples are copy-paste runnable.
- Help follows existing `forward-nexus` style.
