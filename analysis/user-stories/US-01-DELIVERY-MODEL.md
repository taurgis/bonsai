# US-01 Delivery Model

## Epic Goal

Define the optional plugin delivery model before implementation tickets assume a package shape.

The target CLI is already oclif-based, but it is not yet a general user-installable plugin host. Research is developed in this repository as an optional plugin; host loading remains a product and security decision.

## US-01.1 Confirm Optional Plugin Delivery

Priority: P0

As a `forward-nexus` maintainer, I want `research` implemented as an optional plugin package in this repository, so that implementation tickets target the correct repository structure and release path.

Acceptance criteria:

- The decision records this repository as the implementation package.
- The decision records `/Users/thomastheunen/Documents/Projects/forward-nexus` as the host CLI, not the implementation repo.
- The decision states whether `@oclif/plugin-plugins` is in scope for host loading.
- The decision states whether `oclif.manifest.json` generation is required.
- The decision states whether plugin security review is required before host integration.

Notes:

- Plugin path: `src/commands/research.ts` and `src/lib/research/*` in this repository after scaffolding.
- Host path: optional plugin loading or linking in `forward-nexus`; do not add `research` to the host core command registry.

## US-01.2 Preserve Existing CLI Contract

Priority: P0

As a `forward-nexus` maintainer, I want the research feature to fit the existing command, JSON, exit-code, help, and output conventions, so that adding research does not regress current users or scripts.

Acceptance criteria:

- Existing commands keep their current names, aliases, JSON shapes, and exit codes.
- `research` has contract tests for help, flags, JSON, and exit codes.
- `research` does not change command-not-found behavior.
- `research` follows the existing `forward-nexus` contract while keeping implementation code inside the plugin package.

## US-01.3 Name Extension Boundaries

Priority: P1

As a future plugin author, I want the research design to name which extension points are stable and which are internal, so that future integrations do not depend on private module shapes.

Acceptance criteria:

- Public command contract is documented separately from internal cache modules.
- Any future hooks are named as proposals, not silently introduced.
- The first release does not promise plugin APIs unless they are tested and documented.
