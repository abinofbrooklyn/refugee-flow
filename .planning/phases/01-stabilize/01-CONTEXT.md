# Phase 1: Stabilize - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the existing app reliable — fix memory leaks and browser crashes, add loading/error feedback on all data fetches, add a globe rotation toggle UI, patch security vulnerabilities, and configure API CORS and rate limiting. No new features or stack changes (those are Phase 2+).

</domain>

<decisions>
## Implementation Decisions

### Loading states (STAB-02)
- Show a spinner while data is being fetched — applies to all data fetch points in the app
- Claude's discretion on spinner style/placement (centered overlay or inline per component)

### Error feedback (STAB-03)
- Show a clear error message when a data fetch fails — no silent failures
- Claude's discretion on exact presentation (inline message or toast notification)
- No retry button required — just communicate the failure clearly

### Globe rotation toggle (STAB-04)
- Claude's discretion on UI element type and placement — pick the most intuitive option for a 3D globe
- The rotation logic already exists (`this.rotatePause`); just needs a UI wired to it
- Should feel natural to globe interaction (not buried in a menu)

### CORS & rate limiting (STAB-06)
- Whitelist general internet traffic — do NOT restrict to specific known origins
- Block known bots and DDoS attack patterns
- Use a standard rate limiting library (e.g. express-rate-limit) with reasonable defaults
- Return 429 on rate limit breach — Claude's discretion on response format

### Memory leak fixes (STAB-01)
- Fix `componentWillUnmount()` in `GlobeVisual.jsx` — remove all event listeners, dispose THREE.js objects, clear animation loops
- Fix `window.setInterval()` leaks in `MobileLanding.jsx` and `DesktopLanding.jsx` — store and clear interval IDs on unmount
- No component refactoring required for Phase 1 — targeted cleanup only

### Security patches (STAB-05)
- Run `npm audit fix` to patch `@babel/traverse`, `acorn`, `ansi-regex`, and related vulnerabilities
- Goal: zero critical or high severity vulnerabilities in `npm audit` output
- Claude's discretion on handling any breaking changes from audit fixes

### Claude's Discretion
- Spinner design and exact placement
- Error message UI (inline vs. toast)
- Globe rotation toggle widget type and position
- Rate limit thresholds (requests per window)
- 429 response body format

</decisions>

<specifics>
## Specific Ideas

- Spinner should cover the loading period for all data fetches — user should never see a blank/frozen view while data loads
- Globe rotation toggle should feel intuitive without explanation — a play/pause icon or similar convention is appropriate
- Rate limiting should protect against abuse without blocking legitimate users

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `this.rotatePause` in `GlobeVisual.jsx`: Rotation pause logic already implemented — toggle UI just needs to call it
- `src/utils/api.js`: Fetch wrappers where loading/error state hooks should be added
- `server/server.js` + `server/routes/dataRoute.js`: Where CORS and rate limiting middleware belongs

### Established Patterns
- Class components throughout — cleanup goes in `componentWillUnmount()`
- Promise-based fetching with `.then()` chains — error handling needs `.catch()` added
- No existing loading or error state pattern — this phase establishes it

### Integration Points
- GlobeVisual event listeners added in `init()` (lines 178-186, 539-542) — all need removal in `componentWillUnmount()`
- MobileLanding (line 45) and DesktopLanding (lines 61-62) `setInterval` calls — need IDs stored and cleared
- 16 components use `componentWillReceiveProps` (deprecated) — Phase 1 does NOT touch these (Phase 2 handles React upgrade)

</code_context>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-stabilize*
*Context gathered: 2026-03-11*
