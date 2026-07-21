---
"@taurgis/bonsai": patch
---

Fix `list`, `inspect`, and `prune` surfacing a phantom cache entry for any foreign `*.md` file dropped into the research cache directory. `parseArtifact` defaults unrecognized frontmatter to a valid-looking shell (`cache_key: ''`, `status: 'active'`) instead of throwing, so a file that merely has `---`/`---` fences but no Bonsai fields — an unrelated note, a stray README, a different tool's output — was previously treated as a real, "active" cached artifact: it showed up in `list` and matched `prune --artifact-type source` with no usable cache key or source URL to target it individually. Both scan paths (`scanCacheDir`, used by `prune`, and the `.search-index.json` sidecar loader, used by `list`/`inspect`) now exclude any parsed artifact with an empty `cache_key`, matching the same "not ours" signal `findArtifact`'s single-key lookup already relied on.
