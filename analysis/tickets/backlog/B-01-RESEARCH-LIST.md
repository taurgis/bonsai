# B-01: Add `research list`

## Goal

List cached research artifacts without printing full content.

## Scope

- Filter by topic, tag, freshness, artifact type, and capture method.
- Return artifact path, source count, freshness, token estimates, and quality metadata.
- Support `--json`.

## Not Before

- Base artifacts exist in real use.
- `research inspect` has established the metadata shape.
