# Phase 1: Stabilize - Research

**Researched:** 2026-03-11
**Domain:** React class component cleanup, THREE.js disposal, Express middleware (CORS + rate limiting), npm security patches
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **STAB-01 (Memory leaks):** Fix `componentWillUnmount()` in `GlobeVisual.jsx` — remove all event listeners, dispose THREE.js objects, clear animation loops. Fix `window.setInterval()` leaks in `MobileLanding.jsx` and `DesktopLanding.jsx` — store and clear interval IDs on unmount. No component refactoring for Phase 1 — targeted cleanup only.
- **STAB-02 (Loading states):** Show a spinner while data is being fetched — applies to all data fetch points in the app.
- **STAB-03 (Error feedback):** Show a clear error message when a data fetch fails — no silent failures. No retry button required.
- **STAB-04 (Globe rotation toggle):** The rotation logic already exists (`this.rotatePause`); just needs a UI wired to it.
- **STAB-05 (Security patches):** Run `npm audit fix` to patch `@babel/traverse`, `acorn`, `ansi-regex`, and related. Goal: zero critical or high severity vulnerabilities.
- **STAB-06 (CORS + rate limiting):** Whitelist general internet traffic — do NOT restrict to specific known origins. Block known bots and DDoS attack patterns. Use `express-rate-limit` with reasonable defaults. Return 429 on rate limit breach.
- No new features or stack changes in Phase 1. No component refactoring.

### Claude's Discretion
- Spinner design and exact placement
- Error message UI (inline vs. toast)
- Globe rotation toggle widget type and position
- Rate limit thresholds (requests per window)
- 429 response body format

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STAB-01 | App runs without memory leaks when navigating between views | THREE.js disposal API, `cancelAnimationFrame`, `removeEventListener` patterns documented below |
| STAB-02 | App shows loading state while data is being fetched | Existing `ScaleLoader` + `LoadingBar.jsx` components already in codebase; all fetch points mapped |
| STAB-03 | App shows error message when data fetch fails (no silent failures) | Error state patterns for class components; all fetch points identified; `.catch()` is missing throughout |
| STAB-04 | Globe rotation can be toggled on/off by the user | `this.rotatePause` exists and is consumed in `animate()`; `GlobeContainer` already has `rotatePause` state; needs UI only |
| STAB-05 | No critical or high security vulnerabilities in dependencies | `npm audit fix` resolves critical/high without breaking changes for the critical packages; force flag needed for webpack-dev-server; full analysis below |
| STAB-06 | API endpoints have rate limiting and CORS whitelisting | `express-rate-limit` v8 + `cors` v2 are the standard Express 4 libraries; patterns documented below |
</phase_requirements>

---

## Summary

The Refugee Flow app has six stability problems: memory leaks from unmanaged THREE.js/DOM resources, missing loading and error states on fetch calls, a missing UI toggle for existing rotation logic, known security vulnerabilities in build-time dependencies, and an Express server without CORS or rate limiting.

All six problems are addressable with targeted changes — no architectural changes are needed. The codebase already has the loading spinner infrastructure (`react-spinners`, `ScaleLoader`, `LoadingBar.jsx`) but it is only wired up in `GlobeContainer` and `AsyApplicationContainer`. The globe rotation logic is 100% implemented (`this.rotatePause` passed as a prop to `GlobeVisual`); `GlobeContainer` already tracks `rotatePause` in state; the only missing piece is a UI button that calls `setState({ rotatePause: !this.state.rotatePause })`. The security picture is nuanced: `npm audit fix` (without `--force`) resolves all critical and high-severity issues **except** the `ansi-html` / `webpack-dev-server` chain, which requires `--force` but only affects dev tooling — not the production Express server.

**Primary recommendation:** Six discrete tasks, one per requirement, none depending on another — they can be planned and executed in parallel. The security patch task carries the most risk and should be validated first on a clean install.

---

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-spinners | 0.3.2 | Loading spinner components | Already in package.json; `ScaleLoader` already used in `GlobeContainer` and `AsyApplicationContainer` |
| express-rate-limit | 8.3.1 (latest) | Rate limiting middleware for Express | De-facto standard for Express rate limiting; compatible with Express 4 |
| cors | 2.8.6 (latest) | CORS headers middleware for Express | Official npm package, referenced in Express docs; compatible with Express 4 |

### To Install
| Library | Version | Purpose |
|---------|---------|---------|
| express-rate-limit | ^8.0.0 | Rate limiting — not currently in package.json |
| cors | ^2.8.5 | CORS headers — not currently in package.json |

**Installation:**
```bash
npm install express-rate-limit cors
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `express-rate-limit` | `rate-limiter-flexible` | rate-limiter-flexible is more powerful but significantly more complex for this use case |
| inline error `<p>` | react-toastify toast | Toast requires new dependency; inline message is sufficient per locked decision |

---

## Architecture Patterns

### Recommended Project Structure
No structural changes needed. All changes are targeted edits to existing files:

```
src/
├── components/globe/
│   ├── GlobeVisual.jsx       # STAB-01: componentWillUnmount cleanup
│   └── GlobeContainer.jsx    # STAB-02, STAB-03, STAB-04: loading/error/rotation toggle
├── components/landing/
│   ├── MobileLanding.jsx     # STAB-01: clearInterval on unmount
│   └── DesktopLanding.jsx    # STAB-01: clearInterval on unmount
├── components/
│   └── RefugeeRoute.jsx      # STAB-02, STAB-03: loading/error state on fetch
server/
└── server.js                 # STAB-06: add cors + rate limiting middleware
```

### Pattern 1: THREE.js Cleanup in componentWillUnmount
**What:** Dispose geometries, materials, textures; cancel animation frame; remove all event listeners.
**When to use:** Any class component that initializes a THREE.js renderer.

```javascript
// GlobeVisual.jsx - componentWillUnmount
componentWillUnmount() {
  // 1. Cancel animation loop
  if (this.frameId) {
    window.cancelAnimationFrame(this.frameId);
  }

  // 2. Remove all DOM event listeners (mirror of init())
  if (this.mount) {
    this.mount.removeEventListener('mousemove', this.debouncedRaycast, false);
    this.mount.removeEventListener('mousedown', this.onMouseDown, false);
    this.mount.removeEventListener('mousewheel', this.onMouseWheel, false);
    this.mount.removeEventListener('keydown', this.onDocumentKeyDown, false);
    this.mount.removeEventListener('mouseover', this.onMouseOverHandler, false);
    this.mount.removeEventListener('mouseout', this.onMouseOutHandler, false);
  }
  window.removeEventListener('resize', this.onWindowResize, false);

  // 3. Dispose THREE.js objects
  if (this.scene) {
    this.scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(m => m.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
  }

  // 4. Dispose renderer (releases GPU memory)
  if (this.renderer) {
    this.renderer.dispose();
    if (this.mount && this.renderer.domElement) {
      this.mount.removeChild(this.renderer.domElement);
    }
  }

  // 5. Unbind mousetrap
  mousetrap.unbind('esc');
}
```

**Critical finding:** The `init()` method registers a debounced function as the mousemove listener (line 249-250):
```javascript
const debounced = _.debounce(this.raycast_listener, 1000/65);
this.mount.addEventListener('mousemove', debounced, false);
```
The `debounced` reference is created inline and lost — it CANNOT be removed with `removeEventListener('mousemove', this.raycast_listener)`. To fix this, `debounced` must be stored as `this.debouncedRaycast = debounced` so it can be removed in `componentWillUnmount`. This is a targeted change within the existing `init()` method.

The inline arrow function handlers for `mouseover` and `mouseout` (lines 261-262) have the same problem:
```javascript
this.mount.addEventListener('mouseover', () => { this.overRenderer = true  }, false);
this.mount.addEventListener('mouseout', ()=>   { this.overRenderer = false }, false);
```
These must be refactored to named methods or stored references.

Also note: `this.animate()` is called from `GlobeContainer.componentDidMount` (line 384), not from `GlobeVisual` itself. The `frameId` is stored as `this.frameId` on line 882. This is the value to cancel.

### Pattern 2: clearInterval in Landing Components
**What:** Store interval ID as instance variable, clear in `componentWillUnmount`.

```javascript
// MobileLanding.jsx
componentDidMount() {
  d3.select('#nav-show').style('display', 'none');
  window.setTimeout(() => this.setState({ animation: true }), 1000);
  this.videoLoopInterval = window.setInterval(
    () => this.setState({ videoLoop: !this.state.videoLoop }),
    1650
  );
}

componentWillUnmount() {
  clearInterval(this.videoLoopInterval);
}
```

**Note for DesktopLanding:** The TODO comment at line 8 says to replace `setInterval` with CSS keyframe animations, but Phase 1 only fixes the leak — no refactoring. Same clearInterval pattern applies.

### Pattern 3: Loading + Error State on Fetch (Class Component)
**What:** Add `loading` and `error` state fields; set before/after fetch; render conditionally.
**When to use:** Every class component that calls `fetch` or the `get_*` API functions.

```javascript
// Class component pattern
state = {
  loading: true,
  error: null,
  data: null,
}

fetchData() {
  this.setState({ loading: true, error: null });
  get_routeDeath()
    .then(d => {
      this.setState({ data: d, loading: false });
    })
    .catch(err => {
      this.setState({ error: 'Failed to load data. Please refresh.', loading: false });
    });
}

render() {
  const { loading, error, data } = this.state;
  if (loading) return <SpinnerComponent />;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  // normal render
}
```

**Existing infrastructure to reuse:**
- `ScaleLoader` from `react-spinners` — already imported in `GlobeContainer` and `AsyApplicationContainer`
- `LoadingDivWrapper`, `LoaderGraphWrapper`, `LoadingIndicator` from `src/components/LoadingBar.jsx` — already exported
- These are available to import in `RefugeeRoute.jsx` with no new dependencies

**All fetch points that need error handling added:**

| File | Method | Fetch call | Currently has error handler? |
|------|--------|-----------|------------------------------|
| `GlobeContainer.jsx` | `fetchData()` | `fetch(request).then(...)` | No `.catch()` on the chain |
| `AsyApplicationContainer.jsx` | calls `fetchData()` from `fetchers.js` | via `fetchers.js` | No `.catch()` in `fetchers.js` |
| `RefugeeRoute.jsx` | `fetchRefugeeRoutes()` | `get_routeDeath()` + `get_routeIBC()` | No `.catch()` |
| `GlobeRouteButton.jsx` | calls `get_routeCountryList()` | via `api.js` | No `.catch()` |
| `src/utils/api.js` | `get_routeDeath/IBC/CountryList` | `fetch(request)` | No `.catch()` |

**Note on `GlobeContainer.fetchData()`:** This chain has a hidden failure mode — if `fetch` rejects, no catch is present, and `loadingStatus` stays `true` forever. The loading spinner never hides.

### Pattern 4: Globe Rotation Toggle
**What:** Add a button to `GlobeContainer` that toggles `this.state.rotatePause` and propagates via the existing `rotatePause` prop to `GlobeVisual`.
**When to use:** Users want to stop/resume the auto-rotating globe.

The wiring already exists end-to-end:
1. `GlobeContainer.state.rotatePause` (line 327, default: `false`)
2. `<GlobeVisual rotatePause={this.state.rotatePause} ...>` (line 569)
3. `GlobeVisual.componentWillReceiveProps` receives new value and sets `this.rotatePause` (line 607)
4. `this.animate()` calls `this.rotateGlobe(2/1000, this.rotatePause)` (line 879)
5. `rotateGlobe` skips rotation when `cancel === true` (line 632-640)

The only missing piece is a button in `GlobeContainer.render()`:
```javascript
// In GlobeContainer render, add near the globe controls area:
<button
  onClick={() => this.setState(prev => ({ rotatePause: !prev.rotatePause }))}
  title={this.state.rotatePause ? 'Resume rotation' : 'Pause rotation'}
>
  {this.state.rotatePause ? '▶' : '⏸'}
</button>
```
Style using the existing `GlobeControllerButton` styled-component pattern (lines 98-132 of `GlobeContainer.jsx`).

### Pattern 5: Express CORS + Rate Limiting
**What:** Add cors and express-rate-limit middleware before routes in `server/server.js`.

```javascript
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// CORS - allow all origins (per locked decision: general internet traffic)
app.use(cors());

// Rate limiting - protect /data API from abuse
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,                  // 200 requests per window per IP
  standardHeaders: true,     // Return rate limit info in headers
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  skip: (req) => req.path === '/healthz', // exclude health checks if needed
});

app.use('/data', apiLimiter);
app.use('/data', dataRoutes);
```

**express-rate-limit v8 breaking change from v6:** The `onLimitReached` callback was removed in v7. Use `handler` option if custom behavior is needed. The `max` option still works in v8.

### Anti-Patterns to Avoid
- **Removing a listener with a different reference than was used to add it:** Will silently fail. The `debounced` and arrow-function handlers in `GlobeVisual.init()` must be stored as `this.*` properties before they can be removed.
- **Adding `.catch()` to `get_routeDeath` calls without also adding it to `get_routeIBC` nested calls:** Both chained promises in `RefugeeRoute.fetchRefugeeRoutes()` can fail independently; both need coverage.
- **Calling `renderer.dispose()` without removing the canvas from DOM:** Leaves a dangling canvas element.
- **Setting `cors()` after route registration:** Middleware order matters in Express. CORS and rate limiting must be registered before `app.use('/data', dataRoutes)`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limiting | Custom in-memory counter | `express-rate-limit` | Handles window resets, concurrent requests, memory leaks in the counter itself, standard headers (X-RateLimit-*) |
| CORS headers | Manual `res.setHeader('Access-Control-*', ...)` | `cors` npm package | Handles preflight OPTIONS correctly, multiple origin patterns, vary headers |
| Loading spinner | Custom CSS animation | `ScaleLoader` from `react-spinners` (already installed) | Already in codebase, already styled for this app |

**Key insight:** The hardest bugs in this phase are not the features themselves — they are the edge cases in cleanup (the debounced event listener that can't be removed unless stored, the arrow function handlers, the animation frame that keeps running after unmount). These are fixed by being methodical about mirroring `addEventListener` calls with corresponding `removeEventListener` using the exact same function reference.

---

## Common Pitfalls

### Pitfall 1: Anonymous/Debounced Listener Cannot Be Removed
**What goes wrong:** `mount.removeEventListener('mousemove', this.raycast_listener)` does nothing because `debounced` (the actual registered listener) is a different function object.
**Why it happens:** The `_.debounce(fn)` call creates a new wrapper function. Only that wrapper was passed to `addEventListener`.
**How to avoid:** In `init()`, store `this.debouncedRaycast = _.debounce(this.raycast_listener, 1000/65)` then use `this.debouncedRaycast` in both `addEventListener` and `removeEventListener`.
**Warning signs:** Memory profiler shows GlobeVisual event handlers still firing after navigation away from the globe view.

### Pitfall 2: GlobeContainer.fetchData() Has No Error Handler
**What goes wrong:** If the `/data/reduced_war_data` endpoint is down, `fetch` rejects, the `.catch(err => res.json({ error: err }))` in `dataRoute.js` handles the server side but the client-side `fetchData().then().then().then()` chain has no `.catch()`. The `loadingStatus` stays `true` forever, the user sees a spinner indefinitely.
**How to avoid:** Add `.catch(err => this.setState({ loadingStatus: false, loadingError: err.message }))` at the end of the `componentDidMount` chain in `GlobeContainer`.
**Warning signs:** App shows spinner forever with no error message when API is unavailable.

### Pitfall 3: npm audit fix Without --force Leaves webpack-dev-server Vulnerable
**What goes wrong:** `npm audit fix` (no `--force`) resolves the critical `@babel/traverse` and high `acorn`/`ansi-regex` vulnerabilities. But `ansi-html` (used by `webpack-dev-server`) requires `--force` to fix because it installs `webpack-dev-server@5.x`, which is a breaking change.
**Why this matters for STAB-05:** The success criterion is "zero critical or high severity vulnerabilities." `ansi-html` is rated HIGH severity and is pulled in by `webpack-dev-server`.
**How to resolve:** Run `npm audit fix` first to get the easy fixes. Then run `npm audit fix --force` which upgrades `webpack-dev-server` to v5. Since this is a dev dependency only (not in production bundle), the risk is limited to dev workflow breakage. Verify `npm start` still works after the force fix.
**Warning signs:** `npm audit` output still shows `ansi-html` HIGH after non-forced fix.

### Pitfall 4: Three.js Geometry Disposal Does Not Free GPU Memory Without renderer.dispose() or .forceContextLoss()
**What goes wrong:** Calling `geometry.dispose()` and `material.dispose()` frees CPU-side references but the WebGL context keeps GPU textures allocated until the context is released.
**How to avoid:** Call `this.renderer.dispose()` in `componentWillUnmount`. For the texture loaded in `init()` via `new THREE.TextureLoader().load(...)`, store the texture reference and call `texture.dispose()` explicitly.
**Warning signs:** GPU memory in browser devtools does not decrease after navigating away from globe.

### Pitfall 5: express-rate-limit v8 API Changes
**What goes wrong:** Code using `onLimitReached`, `headers: true` (v6 option names), or `draft_polli_ratelimit_headers` will silently fail or throw in v8.
**How to avoid:** Use `standardHeaders: true`, `legacyHeaders: false`, and `handler` (not `onLimitReached`) for v8. The `windowMs` and `max` options are unchanged.

---

## Code Examples

### Verified Cleanup Pattern for THREE.js (from THREE.js documentation)
```javascript
// Traverse scene and dispose all materials/geometries
scene.traverse((object) => {
  if (!object.isMesh) return;
  object.geometry.dispose();
  if (object.material.isMaterial) {
    cleanMaterial(object.material);
  } else {
    for (const material of object.material) cleanMaterial(material);
  }
});

function cleanMaterial(material) {
  material.dispose();
  // Dispose textures
  for (const key of Object.keys(material)) {
    const value = material[key];
    if (value && typeof value === 'object' && 'minFilter' in value) {
      value.dispose(); // it's a texture
    }
  }
}
```

### Verified express-rate-limit v8 Pattern
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min window
  max: 200,                  // max requests per window per IP
  standardHeaders: true,     // RateLimit-* headers per RFC
  legacyHeaders: false,      // disable X-RateLimit-* headers
  message: { error: 'Rate limit exceeded. Try again in 15 minutes.' },
});
```

### Verified cors Pattern for Express 4
```javascript
const cors = require('cors');
// Allow all origins (per user decision: general internet traffic)
app.use(cors());
// OR with explicit options:
app.use(cors({
  methods: ['GET'],
  allowedHeaders: ['Content-Type'],
}));
```

### GlobeContainer: Adding rotatePause Toggle
```javascript
// In render() — add near globe controls
<button
  onClick={() => this.setState(prev => ({ rotatePause: !prev.rotatePause }))}
  aria-label={this.state.rotatePause ? 'Resume globe rotation' : 'Pause globe rotation'}
>
  {this.state.rotatePause ? '▶' : '⏸'}
</button>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Express `app.use((req,res,next) => {...})` custom rate limiting | `express-rate-limit` middleware | v1 (2013+) | Standard headers, proper window math |
| `express-rate-limit` v6 `onLimitReached` | v8 `handler` callback | v7 (2022) | Breaking change in API |
| THREE.js `geometry.dispose()` only | `renderer.dispose()` + traverse | r100+ | GPU memory release |
| `window.setInterval` without cleanup | Store ID, `clearInterval` on unmount | React 16+ best practice | Memory/CPU leaks on unmount |

---

## Open Questions

1. **Does `npm audit fix --force` break the webpack dev server startup?**
   - What we know: `--force` installs `webpack-dev-server@5.x`. WDS 5 changed the config API (e.g., `devServer` options in `webpack.dev.js`).
   - What's unclear: Whether the existing `webpack/webpack.dev.js` config is compatible with WDS 5.
   - Recommendation: Run `npm audit fix --force` in isolation, then immediately run `npm start` to test. If it breaks, investigate the WDS 5 migration guide. The production server (`server/server.js`) is unaffected — this is dev-only risk.

2. **Does DesktopLanding.jsx have one or two interval calls?**
   - What we know: The TODO comment (line 8) says to replace `setInterval` with CSS keyframe animations. Lines 61 and 62 both reference `setInterval`.
   - What's unclear: Whether both are active or one is commented out. Need to read the full file to confirm.
   - Recommendation: Read `DesktopLanding.jsx` lines 55-75 before writing the fix; store each interval ID separately if two exist.

3. **After `npm audit fix`, will there be remaining critical/high vulnerabilities?**
   - What we know: `npm audit` currently reports 31 critical and 69 high. `npm audit fix` (non-forced) changes many of these. `npm audit fix --force` takes care of the `webpack-dev-server` chain.
   - What's unclear: Whether some critical/high vulnerabilities have no available fix (i.e., there is no non-breaking patch). Some issues (e.g., `mapbox-gl@0.45.0`) may not have fixes because the package itself is listed as outdated/replaced.
   - Recommendation: Run `npm audit fix && npm audit fix --force` then `npm audit` to see the residual count. If vulnerabilities remain that have no fix, document them as accepted risk with justification (e.g., `mapbox-gl` is a legacy dependency being removed in Phase 2).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 24.8.0 + Enzyme (configured via `enzyme.config.js`) |
| Config file | `jest.config.js` (exists at project root) |
| Quick run command | `npm test -- --testPathPattern=<file>` |
| Full suite command | `npm test` |

**Current state:** Zero test files exist in `src/`. `jest.config.js` and `enzyme.config.js` are present but no `*.test.js` or `*.spec.js` files exist. This means the full suite runs in seconds but validates nothing. Phase 1 should not be blocked by the absence of tests — the success criteria are behavioral and verified manually or via `npm audit`.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STAB-01 | Memory leaks fixed on navigate | manual-only | n/a — requires browser memory profiler | ❌ |
| STAB-02 | Spinner visible during fetch | manual-only | n/a — requires rendered app | ❌ |
| STAB-03 | Error message shown on fetch failure | manual-only | n/a — requires mocked API failure | ❌ |
| STAB-04 | Globe rotation toggles on button click | manual-only | n/a — requires rendered THREE.js scene | ❌ |
| STAB-05 | Zero critical/high vulns | automated | `npm audit` (exit code 0 if clean) | n/a |
| STAB-06 | Rate limiting returns 429 | integration | `curl -s -o /dev/null -w "%{http_code}" http://localhost:2700/data/reduced_war_data` (200 times fast) | ❌ |

**STAB-05 is the only requirement verifiable in CI.** STAB-01 through STAB-04 require manual verification in the running app. STAB-06 can be smoke-tested with a curl loop.

### Sampling Rate
- **Per task commit:** `npm audit` for STAB-05; `npm test` for any unit tests created
- **Per wave merge:** `npm audit` + manual browser smoke test
- **Phase gate:** `npm audit` shows 0 critical/high + manual navigation test + visible spinner/error in dev server

### Wave 0 Gaps
- [ ] `tests/server/rateLimit.test.js` — integration test for 429 behavior covering STAB-06
- [ ] Framework is already configured — no install needed

*(All Phase 1 tasks are targeted cleanup; unit tests for memory leaks and UI states are out of scope for Phase 1 per the "no refactoring" constraint.)*

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `src/components/globe/GlobeVisual.jsx` (lines 137-139, 178-186, 249-265, 539-542, 604-642, 877-903)
- Direct code inspection: `src/components/globe/GlobeContainer.jsx` (lines 320-395, 560-574)
- Direct code inspection: `src/components/landing/MobileLanding.jsx` (lines 151-155)
- Direct code inspection: `server/server.js` (full file)
- Direct code inspection: `server/routes/dataRoute.js` (full file)
- Direct code inspection: `src/utils/api.js` (full file)
- Direct code inspection: `src/components/utils/fetchers.js` (full file)
- `npm audit` output — live vulnerability scan
- `npm info express-rate-limit` — confirmed v8.3.1 is latest, compatible with Express >=4.11
- `npm info cors` — confirmed v2.8.6 is latest

### Secondary (MEDIUM confidence)
- THREE.js documentation pattern for scene/geometry/renderer disposal (standard practice since r100+)
- express-rate-limit GitHub README — v8 API options (`standardHeaders`, `legacyHeaders`)

### Tertiary (LOW confidence)
- Assumption that `webpack-dev-server@5.x` config API breakage is limited to `devServer` options; needs validation against `webpack/webpack.dev.js` after the force upgrade

---

## Metadata

**Confidence breakdown:**
- STAB-01 (memory leaks): HIGH — exact lines identified; debounced listener pitfall is a real issue requiring the specific fix described
- STAB-02/03 (loading/error): HIGH — existing `ScaleLoader` and `LoadingBar.jsx` infrastructure is in place; all fetch points mapped
- STAB-04 (rotation toggle): HIGH — full prop chain traced end-to-end; only a button + setState is missing
- STAB-05 (security): MEDIUM-HIGH — `npm audit fix` (non-forced) clearly resolves critical issues; `--force` behavior on `webpack-dev-server@5` upgrade needs runtime validation
- STAB-06 (CORS + rate limiting): HIGH — `express-rate-limit` v8 and `cors` v2 are the standard Express 4 solution; middleware order pattern is well-established

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable libraries; npm audit results change as new CVEs are discovered)
