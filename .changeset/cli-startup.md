---
'@taurgis/bonsai': patch
---

CLI startup reads the command manifest instead of loading every command, so `--help` and `--version` no longer pull in the fetch stack or print a manifest-version warning. A missing Salesforce document is rejected from the HTTP status without downloading the page.
