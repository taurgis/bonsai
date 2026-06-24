# Backlog Tickets

These are intentionally outside the MVP ticket sequence. Promote one only when the base research cache is working and a real workflow needs it.

| Backlog | Title | Promote When |
| --- | --- | --- |
| [B-01](B-01-RESEARCH-LIST.md) | `research list` | Users need to browse cached artifacts by topic, freshness, or source. |
| [B-02](B-02-RESEARCH-PRUNE.md) | `research prune` | Cache size becomes a real maintenance problem. |
| [B-03](B-03-BROWSER-RENDERING.md) | Browser-rendered extraction | Static extraction repeatedly fails important docs pages. |
| [B-04](B-04-FULL-TEXT-SEARCH.md) | Advanced full-text cache search | Simple scan-based `research search` is not enough. |
| [B-05](B-05-GENERATED-TOPIC-SYNTHESIS.md) | CLI-generated topic synthesis | Agent-supplied import is not enough and the CLI must synthesize across sources. |
| [B-06](B-06-OFFICIAL-SOURCE-DISCOVERY.md) | Official source discovery | Agents need help finding authoritative URLs before research. |
| [B-07](B-07-EXACT-TOKEN-COUNTING.md) | Exact token counting | Rough `ceil(chars / 4)` estimates mislead real workflows. |
| [B-08](B-08-ROBOTS-TXT.md) | Robots.txt policy | Product requires formal robots compliance, not just polite bounded fetching. |
| [B-09](B-09-MANUAL-CACHE-MIGRATION.md) | Manual cache migration | Existing `artifacts/online-research` notes need migration by real users. |
| [B-10](B-10-FILE-IMPORT.md) | File-based import | Stdin import is not ergonomic for larger saved research files. |

## Backlog Rule

Do not implement backlog work just because it is listed here. Each backlog item needs a fresh owner decision and acceptance criteria review before implementation.
