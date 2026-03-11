# Phase 1: Stabilize — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing app production-safe — patch security vulnerabilities, fix memory leaks, add error handling, and cover critical logic with tests. Zero new features.

**Architecture:** All changes are in-place fixes to existing files. No new architectural layers. Server gets CORS + rate limiting middleware. Client components get proper cleanup in `componentWillUnmount`. Shared fetch utility gets error handling. Redux and data processors get their first unit tests.

**Tech Stack:** Node.js 22, Express 4, React 16, Redux 4, Jest 24, `express-rate-limit`, `cors`

---

## Chunk 1: Security

### Task 1: Patch npm vulnerabilities

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Audit current vulnerabilities**

```bash
npm audit
```

Expected: Several critical/high issues including `@babel/traverse`, `acorn`, `ansi-regex`.

- [ ] **Step 2: Run auto-fix**

```bash
npm audit fix
```

- [ ] **Step 3: Force-fix remaining breaking-change packages**

```bash
npm audit fix --force
```

Note: If `--force` breaks the build (e.g. major webpack dependency upgrades), manually pin the problematic package to a safe patched version instead. Run `npm start` and `npm run build` after to verify nothing broke.

- [ ] **Step 4: Verify build still works**

```bash
npm run build
```

Expected: Build succeeds, `dist/` populated.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "fix: patch npm security vulnerabilities"
```

---

### Task 2: Add CORS and rate limiting to Express API

**Files:**
- Modify: `server/server.js`
- Modify: `package.json` (add `cors`, `express-rate-limit`)

- [ ] **Step 1: Install dependencies**

```bash
npm install cors express-rate-limit
```

- [ ] **Step 2: Write the failing test**

Create `server/routes/__tests__/dataRoute.test.js`:

```javascript
const request = require('supertest');
const app = require('../../testApp');

describe('API security', () => {
  it('includes CORS headers on /data routes', async () => {
    const res = await request(app)
      .get('/data/reduced_war_data')
      .set('Origin', 'http://localhost:8080');
    expect(res.headers['access-control-allow-origin']).toBeDefined();
  });

  it('returns 429 after exceeding rate limit', async () => {
    const requests = Array(101).fill(null).map(() =>
      request(app).get('/data/reduced_war_data')
    );
    const responses = await Promise.all(requests);
    const tooMany = responses.filter(r => r.status === 429);
    expect(tooMany.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Create testApp.js (Express app without listen)**

`dataRoute.js` imports `../database/connection` which attempts a real MongoDB connection. We must mock it in tests to avoid hangs. Create `server/__mocks__/database/connection.js`:

```javascript
// Mock that resolves immediately — no real DB connection in tests
module.exports = Promise.resolve();
```

Then create `server/testApp.js`:

```javascript
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const dataRoutes = require('./routes/dataRoute');

const app = express();

app.use(helmet());
app.use(helmet.referrerPolicy({ policy: 'no-referrer' }));
app.use(compression());
app.use(cors({ origin: ['http://localhost:8080', process.env.CLIENT_ORIGIN].filter(Boolean) }));
app.use('/data', rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use('/data', dataRoutes);
// Static files and SPA catch-all (production)
app.use(express.static(path.join(__dirname, '../dist')));
app.use((req, res) => { res.sendFile(path.join(__dirname, '../dist/index.html')); });

module.exports = app;
```

In `server/routes/__tests__/dataRoute.test.js`, add the mock at the top:

```javascript
jest.mock('../../database/connection', () => Promise.resolve());
```

- [ ] **Step 4: Install supertest**

```bash
npm install --save-dev supertest
```

- [ ] **Step 5: Run tests to verify they fail**

```bash
npx jest server/routes/__tests__/dataRoute.test.js --no-coverage
```

Expected: FAIL — `testApp.js` not yet used in `server.js`.

- [ ] **Step 6: Update server.js to use testApp**

Replace `server/server.js` with — note `testApp.js` now owns all middleware, routing, and static serving:

```javascript
const app = require('./testApp');
const ENV_INFO = require('./helpers/envInfo');

console.info(ENV_INFO);
app.listen(process.env.PORT || 2700);
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
npx jest server/routes/__tests__/dataRoute.test.js --no-coverage
```

Expected: PASS

- [ ] **Step 8: Verify server still starts**

```bash
npm run nodemon &
sleep 3 && curl http://localhost:2700/data/reduced_war_data | head -c 200
kill %1
```

Expected: JSON data returned.

- [ ] **Step 9: Commit**

```bash
git add server/server.js server/testApp.js server/__mocks__/database/connection.js server/routes/__tests__/dataRoute.test.js package.json package-lock.json
git commit -m "fix: add CORS whitelisting and rate limiting to /data endpoints"
```

---

## Chunk 2: Memory Leaks

### Task 3: Fix GlobeVisual event listener and animation frame leak

**Files:**
- Modify: `src/components/globe/GlobeVisual.jsx` (lines 137-139 `componentWillUnmount`)

- [ ] **Step 1: Read the current componentWillUnmount and init method**

Open `src/components/globe/GlobeVisual.jsx`. Note:
- `componentWillUnmount()` at line 137 is empty
- Event listeners added at lines 250, 258-262, 485-487
- `this.frameId = window.requestAnimationFrame(this.animate)` at line 882
- `this.mount` is the canvas DOM ref

- [ ] **Step 2: Store debounced handler on `this` in `init()`**

In `GlobeVisual.jsx`, find the `init()` method at the line that creates the debounced mousemove handler (around line 249). It currently reads:

```javascript
const debounced = ...
this.mount.addEventListener('mousemove', debounced, false);
```

Change `const debounced` to `this.debounced` so it can be removed later:

```javascript
this.debounced = ...
this.mount.addEventListener('mousemove', this.debounced, false);
```

- [ ] **Step 3: Implement componentWillUnmount**

Replace the empty `componentWillUnmount()` body:

```javascript
componentWillUnmount() {
  // Cancel animation loop
  if (this.frameId) {
    window.cancelAnimationFrame(this.frameId);
  }

  // Remove all mount event listeners
  if (this.mount) {
    this.mount.removeEventListener('mousemove', this.debounced, false);
    this.mount.removeEventListener('mousedown', this.onMouseDown, false);
    this.mount.removeEventListener('mousewheel', this.onMouseWheel, false);
    this.mount.removeEventListener('keydown', this.onDocumentKeyDown, false);
    this.mount.removeEventListener('mousemove', this.onMouseMove, false);
    this.mount.removeEventListener('mouseup', this.onMouseUp, false);
    this.mount.removeEventListener('mouseout', this.onMouseOut, false);
  }

  // Dispose THREE.js objects
  if (this.renderer) {
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
```

- [ ] **Step 4: Handle anonymous mouseover/mouseout listeners**

The anonymous arrow function listeners for `mouseover`/`mouseout` added at lines 261-262 cannot be removed (no reference). Replace those `addEventListener` calls in `init()` to use named class methods so they can be removed. Add these methods to the class:

```javascript
onMouseOver = () => { this.overRenderer = true; }
onMouseOutBasic = () => { this.overRenderer = false; }
```

Then update lines 261-262 in `init()`:
```javascript
this.mount.addEventListener('mouseover', this.onMouseOver, false);
this.mount.addEventListener('mouseout', this.onMouseOutBasic, false);
```

And add to `componentWillUnmount`:
```javascript
this.mount.removeEventListener('mouseover', this.onMouseOver, false);
this.mount.removeEventListener('mouseout', this.onMouseOutBasic, false);
```

- [ ] **Step 5: Verify app still works**

```bash
npm start
```

Navigate to the conflict/globe view. Verify globe renders, rotates, responds to mouse. Navigate away and back — no console errors about missing mount.

- [ ] **Step 6: Commit**

```bash
git add src/components/globe/GlobeVisual.jsx
git commit -m "fix: clean up GlobeVisual event listeners and animation frame on unmount"
```

---

### Task 4: Fix landing component setInterval leak

**Files:**
- Modify: `src/components/landing/MobileLanding.jsx` (line 154)
- Modify: `src/components/landing/DesktopLanding.jsx` (line 346)

- [ ] **Step 1: Fix MobileLanding.jsx**

In `MobileLanding.jsx`, find where `window.setInterval` is called (line 154). Store the ID and clear it on unmount:

```javascript
// In componentDidMount (or wherever setInterval is called):
this.videoInterval = window.setInterval(() => this.setState({videoLoop: !this.state.videoLoop}), 1650);
```

Add `componentWillUnmount` (or update if it exists):
```javascript
componentWillUnmount() {
  if (this.videoInterval) {
    window.clearInterval(this.videoInterval);
  }
}
```

- [ ] **Step 2: Fix DesktopLanding.jsx**

Same pattern at line 346:

```javascript
// Store the interval ID:
this.videoInterval = window.setInterval(() => this.setState({ videoLoop: !videoLoop }), 1650);
```

Add/update `componentWillUnmount`:
```javascript
componentWillUnmount() {
  if (this.videoInterval) {
    window.clearInterval(this.videoInterval);
  }
}
```

- [ ] **Step 3: Verify landing page still works**

```bash
npm start
```

Navigate to `/landing`. Verify video loop animation still works. Open browser DevTools → Performance → record 30 seconds → navigate away. Verify no "setState on unmounted component" warnings in console.

- [ ] **Step 4: Commit**

```bash
git add src/components/landing/MobileLanding.jsx src/components/landing/DesktopLanding.jsx
git commit -m "fix: clear setInterval on landing component unmount to prevent memory leak"
```

---

## Chunk 3: Error Handling & Loading States

### Task 5: Add error handling to fetch utility

**Files:**
- Modify: `src/components/utils/fetchers.js`
- Create: `src/components/utils/__tests__/fetchers.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/components/utils/__tests__/fetchers.test.js`:

```javascript
import { fetchData } from '../fetchers';

global.fetch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fetchData', () => {
  it('calls setter with parsed JSON on success', async () => {
    const mockData = { test: true };
    global.fetch.mockResolvedValue({
      json: () => Promise.resolve(mockData),
    });
    const setter = jest.fn();
    const setLoader = jest.fn();

    await fetchData('/test-url', setter, setLoader);

    expect(setter).toHaveBeenCalledWith(mockData);
    expect(setLoader).toHaveBeenCalledWith(false);
  });

  it('calls setter with error object and setLoader(false) when fetch fails', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'));
    const setter = jest.fn();
    const setLoader = jest.fn();

    await fetchData('/test-url', setter, setLoader);

    expect(setter).toHaveBeenCalledWith({ error: 'Network error' });
    expect(setLoader).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/components/utils/__tests__/fetchers.test.js --no-coverage
```

Expected: 2nd test FAIL — no error handling in current `fetchData`.

- [ ] **Step 3: Update fetchers.js with error handling**

```javascript
export const fetchData = (url, setter, setLoader) => fetch(new Request(
  url,
  {
    method: 'GET',
    cache: 'force-cache',
  },
))
  .then(res => res.json())
  .then(data => setter(data))
  .catch(err => setter({ error: err.message }))
  .finally(() => setLoader(false));
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/components/utils/__tests__/fetchers.test.js --no-coverage
```

Expected: All 2 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/utils/fetchers.js src/components/utils/__tests__/fetchers.test.js
git commit -m "fix: add error handling to fetchData utility"
```

---

### Task 6: Add loading and error states to data-fetching components

**Files:**
- Modify: `src/components/globe/GlobeContainer.jsx`
- Modify: `src/components/RefugeeRoute.jsx`
- Modify: `src/components/asylumApplication/AsyApplicationContainer.jsx` ← this is the fetching component, not `AsyApplicationChartContainer.jsx` which only receives props

- [ ] **Step 1: Audit fetch paths in each component**

Read `GlobeContainer.jsx` — it may use its own inline `fetchData` method rather than the shared `src/components/utils/fetchers.js`. If so, wrap its fetch call in the same `.catch(err => setState({ error: true }))` pattern directly. Read `RefugeeRoute.jsx` and `AsyApplicationContainer.jsx`. Find where fetch calls are made and where loading state is tracked (look for `setLoader`, `isLoading`, `ScaleLoader`). Note: `react-spinners` is already installed — `AsyApplicationContainer.jsx` already uses `ScaleLoader`, so follow that same pattern in the other two.

- [ ] **Step 2: Add error UI to GlobeContainer**

In `GlobeContainer`'s render method, check for error state and show a message instead of the globe:

```jsx
// Near top of render():
if (this.state.error) {
  return (
    <div style={{ color: 'white', padding: '2rem', textAlign: 'center' }}>
      Unable to load conflict data. Please try refreshing.
    </div>
  );
}
```

When data setter receives `{ error: ... }`, set `this.setState({ error: true })`.

- [ ] **Step 3: Add loading spinner to GlobeContainer**

```jsx
import { ClipLoader } from 'react-spinners';

// In render(), while loading:
if (this.state.isLoading) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
      <ClipLoader color="#ffffff" />
    </div>
  );
}
```

- [ ] **Step 4: Repeat pattern for RefugeeRoute and AsyApplicationContainer**

Apply the same loading spinner + error message pattern to each component that fetches data.

- [ ] **Step 5: Verify visually**

```bash
npm start
```

Temporarily change the fetch URL in one component to an invalid endpoint. Verify:
- Loading spinner shows while fetching
- Error message shows when fetch fails
- Normal render shows on success

Restore the correct URL.

- [ ] **Step 6: Commit**

```bash
git add src/components/globe/GlobeContainer.jsx src/components/RefugeeRoute.jsx src/components/asylumApplication/AsyApplicationContainer.jsx
git commit -m "feat: add loading spinners and error states to data-fetching components"
```

---

## Chunk 4: Bug Fixes

### Task 7: Fix globe rotation toggle

**Files:**
- Modify: `src/components/globe/GlobeVisual.jsx` (line 630 area — `rotatePause` prop)
- Modify: `src/components/globe/GlobeContainer.jsx` (add toggle button + state)

- [ ] **Step 1: Find the rotation logic**

In `GlobeVisual.jsx`, search for `rotatePause` and `rotateGlobe`. Understand how rotation is controlled.

- [ ] **Step 2: Add rotation state to GlobeContainer**

In `GlobeContainer.jsx`, add rotation toggle state:

```javascript
// In constructor or state:
state = {
  ...this.state,
  isRotating: true,
}

toggleRotation = () => {
  this.setState(prev => ({ isRotating: !prev.isRotating }));
}
```

- [ ] **Step 3: Wire state to GlobeVisual prop**

Pass `isRotating` to `GlobeVisual` as `rotatePause={!this.state.isRotating}` (or match the existing prop name/logic).

- [ ] **Step 4: Add toggle button to GlobeContainer render**

```jsx
<button
  onClick={this.toggleRotation}
  style={{ position: 'absolute', bottom: '1rem', right: '1rem', zIndex: 10 }}
>
  {this.state.isRotating ? 'Pause Rotation' : 'Resume Rotation'}
</button>
```

- [ ] **Step 5: Verify in browser**

```bash
npm start
```

Navigate to conflict/globe view. Verify the rotation toggle button appears and works.

- [ ] **Step 6: Commit**

```bash
git add src/components/globe/GlobeVisual.jsx src/components/globe/GlobeContainer.jsx
git commit -m "fix: add globe rotation toggle button"
```

---

### Task 8: Rename deprecated lifecycle methods

**Files (all 16):**
- `src/components/asylumApplication/AsyApplicationChartContainer.jsx`
- `src/components/globe/GlobeContainer.jsx`
- `src/components/globe/GlobeRouteButton.jsx`
- `src/components/globe/GlobeStatsBoard.jsx`
- `src/components/globe/GlobeTooltips.jsx`
- `src/components/globe/GlobeVisual.jsx`
- `src/components/RefugeeRoute_map_popup.jsx`
- `src/components/RefugeeRoute_map.jsx`
- `src/components/RefugeeRoute_textArea_content_basicInfo.jsx`
- `src/components/RefugeeRoute_textArea_content_currentSelectedPoint.jsx`
- `src/components/RefugeeRoute_textArea_content_ibcCountry.jsx`
- `src/components/RefugeeRoute_textArea_contentManager.jsx`
- `src/components/RefugeeRoute_textArea.jsx`
- `src/components/RefugeeRoute_titleGroup.jsx`
- `src/components/RegionModalButton.jsx`
- `src/components/RegionModalContent.jsx`

- [ ] **Step 1: Bulk rename with sed**

```bash
find src/components -name "*.jsx" -exec sed -i '' 's/componentWillReceiveProps/UNSAFE_componentWillReceiveProps/g' {} +
```

- [ ] **Step 2: Verify no originals remain**

```bash
grep -r "componentWillReceiveProps" src/components --include="*.jsx" | grep -v UNSAFE
```

Expected: No output.

- [ ] **Step 3: Verify app still builds**

```bash
npm run build
```

Expected: Build succeeds, no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/
git commit -m "fix: rename componentWillReceiveProps to UNSAFE_componentWillReceiveProps"
```

---

### Task 9: Remove non-compliant console.log calls

**Files:**
- `src/components/asylumApplication/AsyApplicationChart.jsx`
- `src/components/asylumApplication/AsyApplicationChartContainer.jsx`
- `src/components/globe/GlobeContainer.jsx`
- `src/components/globe/GlobeRouteButton.jsx`
- `src/components/globe/GlobeVisual.jsx`
- `src/components/RefugeeRoute_map.jsx`
- `src/components/RefugeeRoute_textArea_content_basicInfo.jsx`
- `src/components/RefugeeRoute_textArea_content_currentSelectedPoint.jsx`
- `src/components/RefugeeRoute.jsx`
- `src/THREEJSScript/Octree.js`

- [ ] **Step 1: List all console.log instances**

```bash
grep -rn "console\.log" src/ --include="*.js" --include="*.jsx"
```

Review each: if it's debug output (e.g. logging component state, data shape), delete it. If it's meaningful operational logging, replace with `console.info`. Never touch `console.warn` or `console.error`.

- [ ] **Step 2: Remove/replace each instance**

Go file by file. Delete debug `console.log` calls. For any that log meaningful app events (e.g. "Data loaded"), replace with `console.info`.

- [ ] **Step 3: Run ESLint to verify compliance**

```bash
npm run lint
```

Expected: No `no-console` violations for `console.log`.

- [ ] **Step 4: Commit**

```bash
git add src/
git commit -m "fix: remove non-compliant console.log calls"
```

---

## Chunk 5: Tests

### Task 10: Unit tests for dataProcessors.js

**Files:**
- Create: `server/controllers/api/data/helpers/__tests__/dataProcessors.test.js`

- [ ] **Step 1: Write tests**

```javascript
const { reduceGeoPercision, warReducer } = require('../dataProcessors');

describe('reduceGeoPercision', () => {
  it('rounds to specified decimal places', () => {
    expect(reduceGeoPercision(1.23456789, 3)).toBe(1.235);
  });

  it('rounds down correctly', () => {
    expect(reduceGeoPercision(1.23444, 3)).toBe(1.234);
  });

  it('handles integer precision', () => {
    expect(reduceGeoPercision(1.9, 0)).toBe(2);
  });
});

describe('warReducer', () => {
  const makeYear = (points) => ({
    Year: 2020,
    value: { q1: points, q2: [], q3: [], q4: [] },
  });

  it('deduplicates points with identical lat,lng after rounding', () => {
    const points = [
      { lat: 10.5, lng: 20.5, fat: 100 },
      { lat: 10.5, lng: 20.5, fat: 50 }, // duplicate
      { lat: 11.0, lng: 21.0, fat: 30 },
    ];
    const result = warReducer([makeYear(points)]);
    expect(result[0].value.q1).toHaveLength(2);
  });

  it('preserves year structure with q1-q4 keys', () => {
    const result = warReducer([makeYear([])]);
    expect(result[0]).toHaveProperty('Year', 2020);
    expect(result[0].value).toHaveProperty('q1');
    expect(result[0].value).toHaveProperty('q2');
    expect(result[0].value).toHaveProperty('q3');
    expect(result[0].value).toHaveProperty('q4');
  });

  it('sorts quarter points by fatalities descending', () => {
    const points = [
      { lat: 10.0, lng: 20.0, fat: 10 },
      { lat: 11.0, lng: 21.0, fat: 100 },
      { lat: 12.0, lng: 22.0, fat: 50 },
    ];
    const result = warReducer([makeYear(points)]);
    expect(result[0].value.q1[0].fat).toBe(100);
  });

  it('regression: does not collapse all lat=0 points to one entry', () => {
    const points = [
      { lat: 0, lng: 10.0, fat: 5 },
      { lat: 0, lng: 20.0, fat: 5 },
      { lat: 0, lng: 30.0, fat: 5 },
    ];
    const result = warReducer([makeYear(points)]);
    // These have different lngs — should NOT be deduplicated
    expect(result[0].value.q1).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npx jest server/controllers/api/data/helpers/__tests__/dataProcessors.test.js --no-coverage
```

Expected: All PASS (logic is already correct after the uniqBy fix).

- [ ] **Step 3: Commit**

```bash
git add server/controllers/api/data/helpers/__tests__/dataProcessors.test.js
git commit -m "test: add unit tests for dataProcessors warReducer and reduceGeoPercision"
```

---

### Task 11: Unit tests for Redux actions and reducer

**Files:**
- Create: `src/redux/__tests__/conflictActions.test.js`
- Create: `src/redux/__tests__/conflictReducer.test.js`

- [ ] **Step 1: Write action tests**

Create `src/redux/__tests__/conflictActions.test.js`:

```javascript
import { setSelectedYear, setCurrentCountry } from '../actions/conflictActions';
import constants from '../actionConstants';

describe('setSelectedYear', () => {
  it('creates action with correct type and payload', () => {
    const action = setSelectedYear(3);
    expect(action).toEqual({
      type: constants.SET_SELECTED_YEAR,
      selectedYearIndex: 3,
    });
  });
});

describe('setCurrentCountry', () => {
  it('creates action with correct type and payload', () => {
    const action = setCurrentCountry('SYR');
    expect(action).toEqual({
      type: constants.SET_CURRENT_COUNTRY,
      currentCountry: 'SYR',
    });
  });
});
```

- [ ] **Step 2: Write reducer tests**

Create `src/redux/__tests__/conflictReducer.test.js`:

```javascript
import conflictReducer from '../reducers/conflictReducer';
import constants from '../actionConstants';

describe('conflictReducer', () => {
  it('returns default state when called with undefined', () => {
    const state = conflictReducer(undefined, { type: '@@INIT' });
    expect(state).toEqual({ selectedYear: 0, currentCountry: 'GLOBAL' });
  });

  it('updates selectedYear on SET_SELECTED_YEAR', () => {
    const state = conflictReducer(undefined, {
      type: constants.SET_SELECTED_YEAR,
      selectedYearIndex: 5,
    });
    expect(state.selectedYear).toBe(5);
    expect(state.currentCountry).toBe('GLOBAL'); // unchanged
  });

  it('updates currentCountry on SET_CURRENT_COUNTRY', () => {
    const state = conflictReducer(undefined, {
      type: constants.SET_CURRENT_COUNTRY,
      currentCountry: 'AFG',
    });
    expect(state.currentCountry).toBe('AFG');
    expect(state.selectedYear).toBe(0); // unchanged
  });

  it('does not mutate existing state', () => {
    const original = { selectedYear: 2, currentCountry: 'IRQ' };
    const next = conflictReducer(original, {
      type: constants.SET_SELECTED_YEAR,
      selectedYearIndex: 4,
    });
    expect(original.selectedYear).toBe(2); // unchanged
    expect(next.selectedYear).toBe(4);
  });

  it('returns state unchanged for unknown action types', () => {
    const state = { selectedYear: 1, currentCountry: 'SYR' };
    const result = conflictReducer(state, { type: 'UNKNOWN' });
    expect(result).toBe(state); // same reference
  });
});
```

- [ ] **Step 3: Run all tests**

```bash
npx jest src/redux/__tests__/ --no-coverage
```

Expected: All 7 tests PASS.

- [ ] **Step 4: Run full test suite to confirm nothing broken**

```bash
npm test -- --no-coverage
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/redux/__tests__/
git commit -m "test: add unit tests for Redux actions and conflictReducer"
```

---

## Final Verification

- [ ] **Run full test suite**

```bash
npm test -- --no-coverage
```

Expected: All tests pass.

- [ ] **Run linter**

```bash
npm run lint
```

Expected: No errors.

- [ ] **Run production build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Smoke test in browser**

```bash
npm start
```

- Landing page: animations work, no console errors
- Conflict/globe view: globe renders, responds to mouse, rotation toggle works
- Refugee route view: map loads, data appears
- Navigate away from globe and back: no "setState on unmounted component" warnings

---

*Phase 1 plan — 2026-03-11*
