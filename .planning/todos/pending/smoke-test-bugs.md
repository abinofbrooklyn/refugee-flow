---
source: Phase 7 smoke test
date: 2026-03-21
type: bugs
---

# Pre-existing Bugs Discovered During Phase 7 Smoke Test

These are NOT regressions from the TypeScript migration — they exist on master too.

## 1. "Link" button navigates to /route/null
- **Location:** `src/components/RefugeeRoute_textArea_content_currentSelectedPoint.tsx:361`
- **Issue:** `window.open(parsedPoint?.source_url, '_blank')` — when `source_url` is undefined, opens a page at URL "undefined"
- **Fix:** Guard with `if (parsedPoint?.source_url) window.open(...)` or disable the link button when no URL

## 2. MapLibre compass/pitch button appears non-functional
- **Location:** `src/components/RefugeeRoute_map.tsx:267` — `new maplibregl.NavigationControl({})`
- **Issue:** The compass/pitch reset button (triangle arrow below zoom +/-) does nothing visible because the map starts at default bearing/pitch (0/0). Confusing UX.
- **Fix:** Either hide it with `new maplibregl.NavigationControl({ showCompass: false })` or remove entirely and use `new maplibregl.NavigationControl({ visualizePitch: false, showCompass: false })`

## 3. Syria war events appear sparse in 2015
- **Location:** Database / seed data
- **Issue:** 2015 has 0 events tagged with Syria in the `cot` field. Data classification issue in the original seed files.
- **Fix:** Requires ACLED API access to get properly classified war event data (blocked on API access)
