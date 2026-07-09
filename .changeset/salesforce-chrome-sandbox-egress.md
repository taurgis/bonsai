---
"@taurgis/bonsai": patch
---

Auto-detect the Playwright-provisioned Chromium under `PLAYWRIGHT_BROWSERS_PATH` (e.g. Claude Code's remote sandbox) so `--rendered` and Salesforce fetches work there without a manual `CHROME_PATH`. Also fix a bug where a failed Chrome navigation (network/proxy failure) went unchecked in the Salesforce doc fetcher, letting Chrome's own "site can't be reached" interstitial be captured and cached as if it were real article content; both the Salesforce fetcher and the generic `--rendered` path now fail with a clear, specific error instead — naming the blocked host and the sandbox network gateway as the likely cause — rather than a generic Chrome net-error code or a silently wrong result.
