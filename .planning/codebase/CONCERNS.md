# Codebase Concerns

**Analysis Date:** 2026-03-10

## Tech Debt

**Memory leaks in GlobeVisual component:**
- Issue: `componentWillUnmount()` is empty with a TODO comment - all event listeners added in `init()` and various mouse/keyboard handlers are never cleaned up when the component unmounts
- Files: `src/components/globe/GlobeVisual.jsx` (lines 137-139)
- Impact: Long-term memory leaks when navigating away from the globe view. Multiple `addEventListener` calls (mousemove, mousedown, mousewheel, keydown, mouseover, mouseout, etc. at lines 178-186, 539-542) are never removed. THREE.js scene objects are also never disposed.
- Fix approach: Implement proper cleanup in `componentWillUnmount()` - remove all event listeners, dispose THREE.js geometries/materials, clear animation loops, and null out references

**Window.setInterval in landing components without cleanup:**
- Issue: `window.setInterval()` is used in landing page components but never cleared
- Files: `src/components/landing/MobileLanding.jsx` (line 45), `src/components/landing/DesktopLanding.jsx` (line 8-9 TODO comment, line 61, 62)
- Impact: Interval continues running indefinitely even after component unmounts, wasting memory and CPU cycles. Each component instance creates a new interval without tracking or clearing it.
- Fix approach: Store interval IDs and clear them in `componentWillUnmount()`. Use `clearInterval()` to properly clean up. Better yet, replace `setInterval` with CSS keyframe animations as noted in the TODO

**Deprecated React lifecycle methods:**
- Issue: 16 components use `componentWillReceiveProps()` which is deprecated since React 16.3 and unsafe in async rendering
- Files: `src/components/RefugeeRoute_titleGroup.jsx`, `src/components/RefugeeRoute_textArea_content_currentSelectedPoint.jsx`, `src/components/RefugeeRoute_textArea_contentManager.jsx`, `src/components/globe/GlobeVisual.jsx`, `src/components/globe/GlobeContainer.jsx`, `src/components/globe/GlobeTooltips.jsx`, `src/components/globe/GlobeStatsBoard.jsx`, `src/components/globe/GlobeRouteButton.jsx`, `src/components/RegionModalContent.jsx`, `src/components/RefugeeRoute_textArea_content_ibcCountry.jsx`, `src/components/RefugeeRoute_textArea.jsx`, `src/components/RefugeeRoute_textArea_content_basicInfo.jsx`, `src/components/asylumApplication/AsyApplicationChartContainer.jsx`, `src/components/RegionModalButton.jsx`, `src/components/RefugeeRoute_map.jsx`, `src/components/RefugeeRoute_map_popup.jsx`
- Impact: Will cause warnings in React 16.3+. Future versions of React may break these components or disable async features. Unsafe if props changes trigger expensive operations.
- Fix approach: Replace with `UNSAFE_componentWillReceiveProps()` for immediate fix, or better - migrate to `useEffect` hooks with dependencies or `getDerivedStateFromProps()`

**Global console logging left in production code:**
- Issue: 61 instances of `console.log()`, `console.error()`, `console.warn()` scattered throughout source code
- Files: Across multiple components and utilities
- Impact: ESLint rule allows only 'warn', 'error', 'info' (line 17 of `.eslintrc`), but many log statements bypass this. Performance impact in production, exposes internal state to console.
- Fix approach: Remove or replace non-allowed console methods. Use structured logging for production. Add pre-commit hook to catch violations.

**Untyped codebase:**
- Issue: No TypeScript - uses raw JavaScript/JSX with no static type checking
- Files: All `.js` and `.jsx` files in `src/`
- Impact: Prop-drilling errors, incorrect component usage, refactoring hazards. Redux dispatch types are not verified. Late-stage bug discovery.
- Fix approach: Gradual TypeScript migration or add prop-types validation. Start with Redux actions and state types.

## Known Bugs

**Data deduplication logic error (recently fixed):**
- Symptoms: Duplicate geographic coordinates not properly removed during data processing
- Files: `server/controllers/api/data/helpers/dataProcessors.js` (fixed in commit 3dea42c)
- Trigger: Processing points with latitude=0 across multiple longitudes - all would collapse to single entry
- Fix applied: Changed uniqBy from `i.lat && i.lng` (logical AND, evaluates to lng alone) to proper `lat,lng` string composite key
- Risk: Similar logic errors may exist elsewhere in data processing pipeline - search for other uses of `&&` in key generation

**Incomplete rotation toggle in UI:**
- Issue: Globe auto-rotation logic exists but UI toggle is missing
- Files: `src/components/globe/GlobeVisual.jsx` (line 630 TODO comment)
- Impact: `rotateGlobe()` method is called but there's no UI control to activate/deactivate it, user experience is broken
- Workaround: Rotation is always on/off based on default state
- Fix approach: Add toggle button in globe controls and wire to this.rotatePause prop

## Security Considerations

**Critical: Babel arbitrary code execution vulnerability:**
- Risk: `@babel/traverse` <7.23.2 allows arbitrary code execution when compiling specially crafted malicious code
- Files: `node_modules/@babel/traverse` (multiple locations including `@babel/core` and helper packages)
- Current mitigation: None - vulnerability is present in current dependency tree
- Recommendations: Run `npm audit fix` immediately to patch @babel/traverse to 7.23.2+. This is a build-time vulnerability that could affect builds if untrusted code is compiled.

**High: Regular Expression Denial of Service vulnerabilities:**
- Risk: `acorn` 5.5.0-5.7.3 and 6.0.0-6.4.0 have ReDoS in parsing code
- Risk: `ansi-regex` has inefficient regex (in chalk) - causes resource exhaustion
- Files: `node_modules/acorn`, `node_modules/ansi-regex` (via webpack-dev-server, jest dependencies)
- Current mitigation: None
- Recommendations: Run `npm audit fix` to upgrade acorn and ansi-html. webpack-dev-server may need force upgrade.

**Moderate: Babel inefficient regex complexity:**
- Risk: `@babel/helpers` and `@babel/runtime` have inefficient regex in generated code
- Impact: Performance degradation in generated code, potential for ReDoS
- Current mitigation: None
- Recommendations: Run `npm audit fix` to upgrade to @babel/helpers/runtime 7.26.10+

**No CORS/CSRF protection configured:**
- Risk: Express app serves API routes at `/data` without CORS headers or CSRF tokens
- Files: `server/server.js`, `server/routes/dataRoute.js`
- Current mitigation: Helmet is configured but may not include CSRF protection
- Recommendations: Add CSRF token validation for state-changing requests, implement CORS whitelisting, add request validation

**No input validation on data routes:**
- Risk: API endpoints likely accept user input without validation
- Files: `server/routes/dataRoute.js` (not examined in detail)
- Impact: Potential for injection attacks, malformed data causing server errors
- Recommendations: Add schema validation (joi, zod) for all request parameters and payloads

**No authentication/authorization:**
- Risk: `/data` API endpoints are completely open - no auth required
- Impact: Data endpoints could be abused for DoS, data scraping, or overload
- Recommendations: Add authentication (JWT), rate limiting, and authorization checks if data is sensitive

## Performance Bottlenecks

**Giant GlobeVisual component (931 lines):**
- Problem: Single component handles scene setup, animation loop, ray-casting, event handling, and geometry manipulation
- Files: `src/components/globe/GlobeVisual.jsx` (931 lines)
- Cause: Complex THREE.js setup mixed with React component lifecycle
- Improvement path: Extract THREE.js logic into a custom hook or context. Separate event handlers into their own layer. Consider using THREE.js instance outside React for better control.

**GlobeContainer component (992 lines):**
- Problem: Massive wrapper component managing state and UI for globe visualization
- Files: `src/components/globe/GlobeContainer.jsx` (992 lines)
- Cause: Multiple styled components, data loading, Redux integration, and event handling all in one file
- Improvement path: Split into smaller components. Extract styling to separate file. Move data loading to custom hook. Use Redux for state instead of component state.

**RefugeeRoute_textArea_content_basicInfo (747 lines):**
- Problem: Monolithic component with complex conditional rendering and styling
- Files: `src/components/RefugeeRoute_textArea_content_basicInfo.jsx` (747 lines)
- Cause: All content rendering logic in single render method
- Improvement path: Extract sub-components for different sections. Move logic to separate utility functions. Use JSX fragments for cleaner structure.

**RefugeeRoute_textArea_content_ibcCountry (537 lines):**
- Problem: Large component managing search, filtering, and list rendering
- Files: `src/components/RefugeeRoute_textArea_content_ibcCountry.jsx` (537 lines)
- Cause: Fuse.js search logic, state management, and rendering all combined
- Improvement path: Extract search logic to custom hook. Separate search UI from results rendering. Memoize list items with React.memo().

**THREE.js Octree (2141 lines):**
- Problem: Ancient THREE.js spatial indexing library (third-party code) with no TypeScript support or modern structure
- Files: `src/THREEJSScript/Octree.js` (2141 lines)
- Cause: Used for ray-casting performance optimization
- Improvement path: Consider replacing with modern three.js built-in raycaster or babylon.js alternative. If keeping, wrap in typed abstraction layer.

**No code splitting or lazy loading:**
- Problem: All components bundled together - users download entire app even if only viewing landing page
- Files: Webpack config not examined in detail
- Cause: No React.lazy() or route-based code splitting implemented
- Improvement path: Implement route-based code splitting for main routes (landing, globe view, about). Lazy load heavy dependencies like THREE.js only when needed.

## Fragile Areas

**Redux state management - minimal:**
- Files: `src/redux/` - only 2 actions (selectedYear, currentCountry), 1 reducer
- Why fragile: Most state is kept in component state instead of Redux, creating inconsistency. Redux integration is incomplete.
- Safe modification: Any changes to Redux require testing multiple components. Add new state to Redux before adding to components.
- Test coverage: No tests found for Redux logic. Reducer changes have no safety net.

**GlobeVisual - THREE.js initialization:**
- Files: `src/components/globe/GlobeVisual.jsx` init() method and animation loop
- Why fragile: Heavy initialization on mount, complex state management across properties, animation frame callback relies on `this` binding
- Safe modification: Test resize behavior, verify animation loop doesn't drop frames, check memory usage on navigation
- Test coverage: No tests. Changes to camera/scene setup likely break globe visually.

**Data loading and processing pipeline:**
- Files: `src/components/utils/fetchers.js`, `server/controllers/api/data/helpers/dataProcessors.js`, various components
- Why fragile: Recent uniqBy bug (now fixed) indicates data processing has subtle logic errors. No type validation.
- Safe modification: Add comprehensive unit tests for data processing. Add TypeScript to data layer.
- Test coverage: No test files found for data processors.

**Event listener management across multiple components:**
- Files: `src/components/globe/GlobeVisual.jsx`, `src/components/RefugeeRoute_map.jsx`, others
- Why fragile: Event listeners attached without tracking, debouncing logic may cause race conditions
- Safe modification: Create centralized event manager. Always pair addEventListener with removeEventListener.
- Test coverage: No tests for event handling.

## Scaling Limits

**Browser memory with large geographic datasets:**
- Current capacity: Visible when rendering hundreds of conflict/refugee data points with THREE.js
- Limit: Browser crashes or becomes unresponsive with 10000+ points due to Octree complexity and GPU memory
- Scaling path: Implement data aggregation/clustering at higher zoom levels. Use level-of-detail (LOD) rendering. Consider worker threads.

**API request handling:**
- Current capacity: Single-threaded Node.js server, no load balancing configured
- Limit: Server will struggle under concurrent requests when multiple users load data simultaneously
- Scaling path: Add clustering (PM2 configured but may not be optimized). Implement caching (Redis). Add CDN for static assets.

**Redux devtools and state size:**
- Current capacity: Minimal Redux usage keeps bundle small but creates inconsistency
- Limit: If state grows significantly without restructuring, debugging becomes difficult
- Scaling path: Migrate entire state to Redux. Normalize data shapes. Use Redux selectors. Implement reselect for memoization.

## Dependencies at Risk

**React 16.8.6 (deprecated):**
- Risk: Older major version with security fixes no longer being released, deprecated lifecycle methods
- Impact: No new features, no security patches, future library incompatibilities
- Migration plan: Upgrade to React 18+, use hooks, replace componentWillReceiveProps with useEffect

**THREE.js 0.91.0 (extremely old):**
- Risk: Released in 2018, many bugs fixed in newer versions, poor ES6 support
- Impact: Missing features, performance issues, security concerns
- Migration plan: Upgrade to THREE.js r150+ (requires refactoring scene setup)

**Webpack 4 (EOL):**
- Risk: Build tool no longer receiving updates, many security issues in dev dependencies
- Impact: Slow builds, no modern optimization options
- Migration plan: Upgrade to Webpack 5+, consider Vite for faster development

**Mongoose 5.5.11 (outdated):**
- Risk: Major version behind current (v7+), deprecated query syntax
- Impact: Performance issues, missing schema validation features
- Migration plan: Upgrade to Mongoose 7+

**Multiple moderate-severity vulnerabilities:**
- Risk: 10+ moderate severity issues in dev dependencies (ansi-html, ansi-regex, acorn, Babel packages)
- Impact: Build-time and runtime performance degradation, potential code execution
- Migration plan: Run `npm audit fix` immediately, then review and test changes

## Missing Critical Features

**No automated testing:**
- Problem: Zero test files found in source (`*.test.js`, `*.spec.js` in src/)
- Blocks: Confident refactoring, regression detection, continuous integration
- Impact: Any change risks breaking existing functionality silently

**No error handling for API failures:**
- Problem: Data fetching doesn't have try/catch or error state UI
- Blocks: Graceful degradation when API is down
- Impact: Users see blank/broken views instead of error messages

**No loading states on API calls:**
- Problem: While data loads, UI doesn't indicate loading state
- Blocks: User feedback about data processing
- Impact: Users think app is frozen during long loads

**No analytics or monitoring:**
- Problem: No tracking of user interactions, errors, or performance metrics
- Blocks: Understanding user behavior, detecting production issues
- Impact: Can't diagnose why users aren't using globe features

**No offline support:**
- Problem: App is entirely dependent on live API data
- Blocks: Using app without internet connection
- Impact: Users on poor connections get broken experience

**No keyboard navigation for accessibility:**
- Problem: mousetrap is configured but keyboard shortcuts not documented or comprehensive
- Blocks: WCAG accessibility compliance
- Impact: Users with disabilities unable to access all features

## Test Coverage Gaps

**No unit tests for Redux:**
- What's not tested: Action creators (conflictActions.js), reducers (conflictReducer.js), reducer composition
- Files: `src/redux/actions/conflictActions.js`, `src/redux/reducers/conflictReducer.js`
- Risk: Redux logic changes break silently. Reducer bugs go undetected until components fail.
- Priority: High - Redux is the state backbone

**No unit tests for data processing:**
- What's not tested: Data normalization, deduplication, transformation in dataProcessors.js
- Files: `server/controllers/api/data/helpers/dataProcessors.js` (exact path unknown, needs investigation)
- Risk: More subtle bugs like the uniqBy issue slip through. Data corruption in production.
- Priority: High - Data integrity is critical

**No component integration tests:**
- What's not tested: Components rendering with Redux state, data flow between components
- Files: All components in `src/components/`
- Risk: Component bugs only found when user navigates. Prop drilling errors.
- Priority: Medium - Most critical paths should be covered

**No end-to-end tests:**
- What's not tested: Landing page flow, globe interaction flow, data loading flow
- Files: Entire application
- Risk: Breaking changes only discovered by manual testing
- Priority: Medium - Key user journeys need coverage

**No performance tests:**
- What's not tested: Memory leaks, frame rate with large datasets, bundle size regression
- Files: GlobeVisual.jsx, bundle output
- Risk: Shipping performance regressions, user experience degradation unnoticed
- Priority: Medium - Critical for data visualization app

---

*Concerns audit: 2026-03-10*
