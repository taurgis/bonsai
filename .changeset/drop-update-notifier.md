---
'@taurgis/bonsai': patch
---

Startup no longer checks npm for a newer release, so `--help` and ordinary commands do not pay for that lookup. `NO_UPDATE_NOTIFIER` has no effect; use `npm outdated @taurgis/bonsai` when you want the check.
