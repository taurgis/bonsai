---
topic: CDP Page domain load completion detection loadEventFired frameStoppedLoading
slug: cdp-page-load-detection
tier: stable
sources:
  - https://chromedevtools.github.io/devtools-protocol/tot/Page/
fetched_at: 2026-06-24T00:00:00Z
validated_at: 2026-06-24T00:00:00Z
source_version: Chrome DevTools Protocol (tip-of-tree)
status: active
---

# CDP Page Domain: Load Completion Detection

Source: https://chromedevtools.github.io/devtools-protocol/tot/Page/

## Page.enable (method)

Must be called before any Page domain events are delivered.

Parameters:
- `enableFileChooserOpenedEvent` (boolean, optional, experimental) — if true, emits Page.fileChooserOpened regardless of setInterceptFileChooserDialog state

## Events

### Page.domContentEventFired
Fires when the DOMContentLoaded event fires in the page (DOM parsed, deferred scripts run; external resources may still be loading).

Parameters:
- `timestamp` (Network.MonotonicTime)

### Page.loadEventFired
Fires when the page's load event fires (all resources including images and stylesheets have loaded).

Parameters:
- `timestamp` (Network.MonotonicTime)

### Page.frameStoppedLoading
Fires when an individual frame has stopped loading.

Parameters:
- `frameId` (FrameId) — identifies which frame stopped loading

### Page.frameStartedNavigating (experimental)
Fires when a frame starts a navigation. Useful for detecting navigation initiation before the old page unloads.

Parameters: frameId, url, loaderId, navigationType

## Recommended sequence for reliable load detection

For a top-level navigation:
1. Call `Page.enable` and `Network.enable` before navigating
2. Issue the navigation (e.g. via `Page.navigate`)
3. Wait for `Page.loadEventFired` — this is the most reliable single signal that the initial HTML, CSS, JS and images are done
4. Use `Page.frameStoppedLoading` for the main frame (frameId matches the main frame) as a corroborating signal

For SPA navigation / XHR interception (no full page load):
- `Page.loadEventFired` fires once on initial load; subsequent SPA navigations do not re-fire it
- Use `Network.loadingFinished` on the specific XHR/fetch requestId of interest instead
- Network idle heuristics (no Network.requestWillBeSent for N ms) can detect SPA quiescence but are not a formal CDP event

## Notes
- `Page.frameStoppedLoading` fires per-frame; for multi-frame pages, the main frame's event is the one to watch
- `Page.domContentEventFired` fires before images load; prefer `Page.loadEventFired` unless you only need DOM readiness
- Both Page and Network domains must be enabled before their events are delivered
