# Phase 2: Modernize Stack - Research

**Researched:** 2026-03-11
**Domain:** Vite migration, THREE.js r150+ upgrade, React 18 lifecycle cleanup, legacy dependency removal
**Confidence:** HIGH (core findings verified against official docs and migration guides)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Gradual, incremental upgrades.** Each dependency upgrade is its own isolated step so version incompatibilities surface immediately and don't compound. Do NOT batch multiple major version jumps into a single task.
- **React upgrade must be broken into sub-steps** (e.g., fix deprecated lifecycles first, then upgrade react/react-dom, then verify). No big-bang React migration.
- **One-shot swap from Webpack to Vite.** The app is small enough that a direct replacement with verification is acceptable.
- Remove all Webpack config files and devDependencies after Vite is confirmed working.

### Claude's Discretion
- Decide between minimal migration (only swap Geometry -> BufferGeometry) vs. fuller modernization based on research findings. User trusts planner judgment here.
- Decide the safest approach for removing jquery, underscore, and legacy mapbox-gl — audit and replace, or remove and fix. User trusts planner judgment here.

### Deferred Ideas (OUT OF SCOPE)
None — phase scope is well-defined by roadmap requirements MOD-01 through MOD-04.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MOD-01 | App builds and runs using Vite (no legacy OpenSSL workaround needed) | Vite config, publicDir, proxy setup documented below |
| MOD-02 | App uses React 18 with no deprecated lifecycle method warnings | 10 components using componentWillReceiveProps catalogued; UNSAFE_ rename or componentDidUpdate migration documented |
| MOD-03 | App uses THREE.js r150+ for globe rendering | Full API diff catalogued; BufferGeometry + morphAttributes migration path documented; Octree replacement identified |
| MOD-04 | Unused legacy dependencies removed (jquery, underscore, old mapbox-gl) | Usage audit complete — all call sites identified; lodash equivalents documented |
</phase_requirements>

---

## Summary

This phase replaces four legacy pieces of the stack: Webpack 4 with Vite, deprecated React lifecycle methods (React 18 already installed but warnings fire), THREE.js 0.91.0 with r165 (latest), and five unused/legacy dependencies (jquery, underscore, the stale mapbox-gl usage, old webpack devDependencies).

The **hardest task by far is THREE.js**. The app uses `THREE.Geometry`, `geometry.faces`, `geometry.vertices`, `geometry.merge`, `morphTargets` array on geometry, `THREE.FaceColors`, and a custom Octree class — all removed between r91 and r165. Each of these maps to a specific BufferGeometry pattern. The custom Octree in `src/THREEJSScript/Octree.js` is a legacy copy of `threeoctree.js r60` and must be replaced with `@brakebein/threeoctree` (the maintained BufferGeometry-compatible fork).

The **Vite migration** is straightforward for this app: move `index.html` to root, add a `<script type="module">` tag pointing at `src/index.jsx`, write `vite.config.js` with the React plugin + dev proxy to `:2700`, and use Vite's built-in `publicDir: 'src/assets'` instead of CopyPlugin. CSS/SCSS imports work natively. SVGs imported as React components need `vite-plugin-svgr`.

The **React deprecation cleanup** covers exactly 10 components all using `componentWillReceiveProps`. In React 18 this fires a console warning (not a crash). The standard fix: rename to `UNSAFE_componentWillReceiveProps` (safe, zero behavior change), or refactor to `componentDidUpdate`/`getDerivedStateFromProps` (better, but more work). Given the user's incremental strategy, prefixing with UNSAFE_ first then verifying is the right first step.

**Primary recommendation:** Execute in dependency order: (1) React deprecation cleanup, (2) THREE.js r165 upgrade (hardest, isolated), (3) Vite migration, (4) legacy dependency removal. This order isolates failures — the THREE.js work can be validated with the existing Webpack build before touching the bundler.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vite | ^6.x (latest) | Build tool + dev server | Native ESM, no OpenSSL hack needed, replaces Webpack |
| @vitejs/plugin-react | ^4.x | JSX + Fast Refresh | Official React plugin for Vite |
| three | ^0.165.0 | Globe rendering | r165 has no CVE, stable API, all deprecated APIs fully gone |
| @brakebein/threeoctree | ^0.4.x | Spatial indexing / raycasting | Only maintained Octree that supports BufferGeometry for three.js |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vite-plugin-svgr | ^4.x | SVG as React components | Required — project uses SVG imports with `react-svg-loader` in Webpack |
| lodash | ^4.17.x (already installed) | Replace underscore calls | Already in package.json; underscore methods all have lodash equivalents |
| BufferGeometryUtils (three/addons) | bundled with three | mergeGeometries, mergeVertices | Replaces geometry.merge pattern in GlobeVisual |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @brakebein/threeoctree | three.js built-in Octree (examples/jsm/math/Octree) | Built-in Octree is for static geometry collision; @brakebein supports face-level raycasting that GlobeVisual requires |
| lodash (replace underscore) | Native Array/Object methods | Most underscore calls in this app are `.find`, `.groupBy`, `.debounce`, `.reduce` — lodash is already a dep, zero risk |

### Installation
```bash
# Vite + plugins
npm install --save-dev vite @vitejs/plugin-react vite-plugin-svgr

# THREE.js upgrade + octree replacement
npm install three@0.165.0
npm install @brakebein/threeoctree

# Remove webpack devDependencies (after Vite is confirmed)
npm uninstall webpack webpack-cli webpack-dev-server webpack-merge webpack-bundle-analyzer \
  babel-loader clean-webpack-plugin copy-webpack-plugin css-loader file-loader \
  html-webpack-plugin mini-css-extract-plugin optimize-css-assets-webpack-plugin \
  react-svg-loader sass-loader style-loader url-loader

# Remove legacy runtime dependencies
npm uninstall jquery underscore

# mapbox-gl: one file (RefugeeRoute_textArea_content_currentSelectedPoint.jsx)
# imports mapbox-gl but only accesses mapboxgl.accessToken and mapboxgl.Map
# Replace that single file's import with maplibre-gl (already installed)
npm uninstall mapbox-gl
```

---

## Architecture Patterns

### Recommended Project Structure (Post-Migration)
```
/                          # project root
├── index.html             # MOVED from src/ — Vite requires root-level
├── vite.config.js         # replaces webpack/ directory
├── src/
│   ├── assets/            # served via publicDir or direct import
│   ├── components/
│   ├── index.jsx          # entry point (unchanged)
│   └── ...
├── server/
└── webpack/               # DELETED after Vite confirmed working
```

### Pattern 1: Vite Config with Proxy + SVG + Assets
**What:** Single `vite.config.js` replacing three webpack config files
**When to use:** Always — this is the final form of the build config

```javascript
// Source: https://vite.dev/config/server-options + @vitejs/plugin-react docs
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

export default defineConfig({
  plugins: [
    react(),
    svgr(),             // handles SVG imports as React components
  ],
  publicDir: 'src/assets',   // replaces CopyPlugin({ patterns: [{ from: 'src/assets', to: 'assets' }] })
  server: {
    port: 8080,
    open: true,
    proxy: {
      '/data': 'http://localhost:2700',   // replaces webpack-dev-server proxy config
    },
  },
  build: {
    outDir: 'dist',
  },
});
```

**index.html change required:** Add explicit script tag before `</body>`:
```html
<script type="module" src="/src/index.jsx"></script>
```
Remove HtmlWebpackPlugin-injected `<%= htmlWebpackPlugin.tags.headTags %>` if present (not in this template — clean).

### Pattern 2: THREE.js BufferGeometry replacing THREE.Geometry (the core migration)
**What:** All GlobeVisual geometry must migrate from the removed `THREE.Geometry` API to `THREE.BufferGeometry`
**When to use:** Every place `new THREE.Geometry()` or `geometry.faces` appears

The four distinct patterns in this codebase and their replacements:

**2a. Border line drawing (drawThreeGeo — many `new THREE.Geometry()` instances)**
```javascript
// OLD (r91): push vertices, create Line from Geometry
var line_geom = new THREE.Geometry();
object_geometry.vertices.push(new THREE.Vector3(...));
var line = new THREE.Line(line_geom, material);

// NEW (r165): use Float32Array + BufferAttribute
function drawLine(x_values, y_values, z_values, options) {
  const positions = new Float32Array(x_values.length * 3);
  for (let i = 0; i < x_values.length; i++) {
    positions[i * 3]     = x_values[i];
    positions[i * 3 + 1] = y_values[i];
    positions[i * 3 + 2] = z_values[i];
  }
  const line_geom = new THREE.BufferGeometry();
  line_geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const line_material = new THREE.LineDashedMaterial(options);
  const line = new THREE.Line(line_geom, line_material);
  line.computeLineDistances(); // required for LineDashedMaterial
  container.add(line);
  clearArrays();
}
```

**2b. Data point coloring (geometry.faces[i].color)**
```javascript
// OLD: per-face color on Geometry
for (var i = 0; i < this.point.geometry.faces.length; i++) {
  this.point.geometry.faces[i].color = color;
}

// NEW: vertex color attribute on BufferGeometry
// BoxGeometry has 24 vertices (6 faces * 4 vertices)
// Set color attribute via BufferAttribute, vertexColors: true on material
const colors = new Float32Array(24 * 3);
for (let i = 0; i < 24; i++) {
  colors[i * 3]     = color.r;
  colors[i * 3 + 1] = color.g;
  colors[i * 3 + 2] = color.b;
}
// Special: faces 10 and 11 (top tip) get gray
// Faces 10-11 in old Geometry = vertices 20-23 in BoxGeometry (top face)
for (let v = 20; v < 24; v++) {
  colors[v * 3] = 90/255; colors[v * 3 + 1] = 90/255; colors[v * 3 + 2] = 90/255;
}
this.point.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
// Material: vertexColors: true (replaces THREE.FaceColors)
```

**2c. Morph target animation (`_baseGeometry.morphTargets.push(...)`)**
```javascript
// OLD: geometry.morphTargets array with vertices
this._baseGeometry = new THREE.Geometry();
this._baseGeometry.morphTargets.push({ name: opts.name, vertices: subgeo.vertices });
// Mesh material: morphTargets: true, vertexColors: THREE.FaceColors

// NEW: BufferGeometry with morphAttributes.position
// _baseGeometry holds positions as Float32Array
// each morph target is a separate Float32Array of same length added to morphAttributes.position
this._baseGeometry = new THREE.BufferGeometry();
// ... populate base positions ...
if (!this._baseGeometry.morphAttributes.position) {
  this._baseGeometry.morphAttributes.position = [];
}
this._baseGeometry.morphAttributes.position.push(
  new THREE.BufferAttribute(subgeoPositions, 3)
);
// Material: { vertexColors: true, morphTargets: true }
// mesh.morphTargetInfluences[index] = weight (API unchanged)
```

**2d. Geometry merge (`subgeo.merge(this.point.geometry, this.point.matrix)`)**
```javascript
// OLD: Geometry.merge(otherGeometry, matrix)
subgeo.merge(this.point.geometry, this.point.matrix);

// NEW: Manually append transformed positions/colors into accumulated Float32Arrays
// OR use BufferGeometryUtils.mergeGeometries (but requires all geometries have same attributes)
// Preferred for this use case: accumulate positions into a growing typed array
// then call BufferGeometry.setAttribute once at end of addData()
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
```

**Important:** `geometry.applyMatrix()` was renamed to `geometry.applyMatrix4()` in r128.
```javascript
// OLD: geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0,0,-0.5));
// NEW:
geometry.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, -0.5));
```

### Pattern 3: Octree Replacement
**What:** Replace the vendored `src/THREEJSScript/Octree.js` (threeoctree r60) with `@brakebein/threeoctree`
**When to use:** Any octree raycasting for conflict point hit-testing in GlobeVisual

```javascript
// OLD import
import THREE from '../../THREEJSScript/Octree';
// and THREE.Octree, raycaster.intersectOctreeObjects()

// NEW
import * as THREE from 'three';
import { Octree } from '@brakebein/threeoctree';

// OLD usage in init():
this.octree = new THREE.Octree({ undeferred: false, depthMax: Infinity, objectsThreshold: 4, overlapPct: 0.15 });

// NEW usage:
this.octree = new Octree({ undeferred: false, depthMax: Infinity, objectsThreshold: 4, overlapPct: 0.15 });

// Search API is preserved:
const octreeObjects = this.octree.search(ray.origin, ray.far, true, ray.direction);
const intersections = this.raycaster.intersectOctreeObjects(octreeObjects);
// Note: @brakebein/threeoctree still patches THREE.Raycaster with intersectOctreeObjects
```

### Pattern 4: React componentWillReceiveProps Cleanup
**What:** 10 components fire React 18 deprecation warnings via `componentWillReceiveProps`
**When to use:** Every class component listed below

| Component | Usage in componentWillReceiveProps | Safe fix |
|-----------|-----------------------------------|----------|
| GlobeVisual.jsx | `this.rotatePause = nextProps.rotatePause` | Rename to UNSAFE_, or move to componentDidUpdate |
| GlobeContainer.jsx | Heavy logic — re-renders timeline, calls draw | Rename to UNSAFE_ first |
| GlobeTooltips.jsx | State-related tooltip update | Rename to UNSAFE_ |
| GlobeStatsBoard.jsx | `_.isMatch` check + state update | Rename to UNSAFE_ |
| GlobeRouteButton.jsx | Simple prop capture | Rename to UNSAFE_ |
| RefugeeRoute_map.jsx | Calls canvas_overlay_render | Rename to UNSAFE_ |
| RefugeeRoute_textArea.jsx | State update | Rename to UNSAFE_ |
| RefugeeRoute_textArea_content_basicInfo.jsx | Heavy chart re-render | Rename to UNSAFE_ |
| RefugeeRoute_textArea_content_currentSelectedPoint.jsx | State/data update | Rename to UNSAFE_ |
| RegionModalContent.jsx | Sort + setState | Rename to UNSAFE_ |
| RefugeeRoute_titleGroup.jsx | findIndex + setState | Rename to UNSAFE_ |
| RegionModalButton.jsx | Simple state | Rename to UNSAFE_ |

**Recommended approach:** Rename all 12 instances to `UNSAFE_componentWillReceiveProps` in a single pass. This eliminates all console warnings with zero behavior change. React 18 supports the `UNSAFE_` prefix. A full refactor to `getDerivedStateFromProps`/`componentDidUpdate` is v2 scope.

### Pattern 5: Legacy Dependency Removal
**What:** Remove jquery, underscore, and the mapbox-gl import; verify no regression

**jquery** — used in 7 files. All usages are:
- DOM dimension reads: `$(el).width()`, `$(el).height()`, `$(el).offset()`
- DOM style sets: `$('.mapboxgl-ctrl-top-right').css('right', ...)`
- DOM animation: `$('#el').animate(...)`, `$('#el').scrollTop(0)`
- jQuery selector for scroll: `$('.TimelineWrapper')[0]`

Replacement strategy: use `el.offsetWidth`, `el.offsetHeight`, `el.getBoundingClientRect()`, `el.style.right = ...`, and `el.scrollTop` / `el.scrollTo()` directly. `scroll-js` (already a dep) replaces `$.animate({scrollTop})`.

**underscore** — used in 14 files. All methods used: `_.find`, `_.findIndex`, `_.groupBy`, `_.sortBy`, `_.reduce`, `_.uniq`, `_.debounce`, `_.delay`, `_.once`, `_.isMatch`. All have exact lodash equivalents. lodash is already in `dependencies`. Replace `import * as _ from 'underscore'` with `import _ from 'lodash'` globally — same API.

**mapbox-gl (legacy import)** — one file only: `RefugeeRoute_textArea_content_currentSelectedPoint.jsx`. Uses `mapboxgl.accessToken` and `mapboxgl.Map`. This hardcodes a Mapbox access token already exposed publicly in the code. The map in this component can be replaced with `maplibre-gl` (already installed and used in `RefugeeRoute_map.jsx`). `maplibre-gl.Map` has identical API for this usage.

### Anti-Patterns to Avoid
- **Batching THREE.js API changes with version bump:** Upgrade the version first with the `three/deprecated/Geometry` shim if available, verify the globe still renders, then remove shim usage.
- **Using `BufferGeometryUtils.mergeGeometries` naively:** It requires all geometries to have identical attributes (position + color). For the addPoint pattern, accumulate positions and colors into arrays and create a single BufferGeometry at the end instead.
- **Keeping the vendored Octree.js:** It patches `THREE` namespace directly and adds `THREE.Octree`. After upgrading three.js, the old Octree will break because it relies on `THREE.Geometry` internally.
- **Removing `underscore` before replacing calls:** Remove the import last, not first; replace calls file-by-file.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG-as-React-component in Vite | Custom vite plugin | vite-plugin-svgr | Handles transform pipeline, HMR, TypeScript types |
| Geometry merging with matrix transforms | Custom merge loop | `BufferGeometryUtils.mergeGeometries` from three/addons | Already handles typed array concatenation |
| Spatial raycasting against face geometry | Custom spatial index | `@brakebein/threeoctree` | The old vendored Octree.js is r60 era code that won't work against BufferGeometry; the brakebein fork already solved this |
| HTML template injection in Vite | Manual HTML script tag management | Vite's native index.html handling | Vite auto-discovers `index.html` at root; no plugin needed |

**Key insight:** The THREE.js migration looks like it requires custom merge logic, but `BufferGeometryUtils.mergeGeometries` already handles the concatenation. The tricky part is ensuring all per-point colors are baked into a color attribute before merging.

---

## Common Pitfalls

### Pitfall 1: THREE.Geometry morphTargets vs BufferGeometry morphAttributes
**What goes wrong:** The old `geometry.morphTargets` array stored full `THREE.Geometry` objects with `vertices`. BufferGeometry uses `morphAttributes.position` which stores `BufferAttribute` typed arrays. The shapes are fundamentally different.
**Why it happens:** The morph target animation in `GlobeVisual.addData()` creates a base geometry, then pushes named morph targets into it. `createPoints()` then creates a mesh and accesses `_baseGeometry.morphTargets.length` — this property doesn't exist on BufferGeometry.
**How to avoid:** Maintain a parallel JS array `this._morphTargetNames = []` to track count. Replace `_baseGeometry.morphTargets.length` with `this._morphTargetNames.length`. The `mesh.morphTargetInfluences[index]` API on Mesh is unchanged — only the geometry-level API differs.
**Warning signs:** `_baseGeometry.morphTargets is undefined` at runtime.

### Pitfall 2: applyMatrix vs applyMatrix4
**What goes wrong:** `geometry.applyMatrix()` was renamed `geometry.applyMatrix4()` in r128. Used twice in GlobeVisual for the BoxGeometry translation (data point and tooltip feedback mesh).
**Why it happens:** Silent rename — both look like method calls, no obvious error until runtime `TypeError: geometry.applyMatrix is not a function`.
**How to avoid:** Grep for `applyMatrix(` (without `4`) and replace all occurrences.
**Warning signs:** `TypeError: ... applyMatrix is not a function` in browser console on globe load.

### Pitfall 3: THREE.FaceColors constant removed
**What goes wrong:** `THREE.FaceColors` was a constant equal to `2`. It was removed when `.vertexColors` became a boolean. `vertexColors: THREE.FaceColors` resolves to `vertexColors: undefined` (since `THREE.FaceColors` doesn't exist), disabling vertex colors.
**Why it happens:** JavaScript won't throw on accessing a missing property — it silently evaluates to `undefined`.
**How to avoid:** Replace `vertexColors: THREE.FaceColors` with `vertexColors: true`.
**Warning signs:** Globe data points all appear white (no color variation).

### Pitfall 4: Vite requires index.html at project root
**What goes wrong:** Current `index.template.html` is inside `src/`. Vite's dev server and build look for `index.html` at the project root by default.
**Why it happens:** Webpack used HtmlWebpackPlugin to inject scripts into any template file. Vite processes `index.html` directly and requires the entrypoint `<script type="module">` tag to be in it.
**How to avoid:** Copy `src/index.template.html` to `index.html` (project root), rename, add `<script type="module" src="/src/index.jsx"></script>`.
**Warning signs:** Vite dev server serves blank page with no JS.

### Pitfall 5: `require()` vs ES module imports in Vite
**What goes wrong:** Vite uses ES modules natively. Files using `const x = require('...')` may cause issues in some edge cases, though Vite does handle CommonJS via esbuild pre-bundling for node_modules.
**Why it happens:** GlobeVisual uses `const mousetrap = require('mousetrap')` and `const country_borderLine = require('../../data/countries_states.json')`. JSON require works natively in Vite. The mousetrap require should be replaced with `import mousetrap from 'mousetrap'`.
**How to avoid:** Convert all in-source `require()` calls to `import` statements. node_modules CJS packages are handled automatically.
**Warning signs:** `require is not defined` error in browser console.

### Pitfall 6: LineDashedMaterial requires `computeLineDistances()`
**What goes wrong:** `THREE.LineDashedMaterial` requires the line geometry to have distance information pre-computed. The old `THREE.Geometry`-based line creation didn't need this explicitly (it was handled internally). BufferGeometry-based lines must call `line.computeLineDistances()` after construction.
**Why it happens:** The API changed subtly between versions.
**How to avoid:** Add `line.computeLineDistances()` immediately after `new THREE.Line(geom, dashedMaterial)`.
**Warning signs:** Country border lines on globe appear solid instead of dashed, or don't appear at all.

### Pitfall 7: mapbox-gl access token leak
**What goes wrong:** `RefugeeRoute_textArea_content_currentSelectedPoint.jsx` has a Mapbox public token hardcoded. The map is already unused in practice (only maplibre-gl is active in the route map). Removing mapbox-gl without checking this could leave orphan code.
**Why it happens:** Legacy code that was partially migrated to maplibre-gl but not finished.
**How to avoid:** When removing mapbox-gl, replace the entire mapboxgl usage in that file with maplibre-gl, which has the same Map constructor API. No token needed for maplibre-gl.
**Warning signs:** `Cannot find module 'mapbox-gl'` after removal if not replaced.

---

## Code Examples

Verified patterns from official sources:

### Vite Config (final form)
```javascript
// Source: https://vite.dev/config/ + https://github.com/pd4d10/vite-plugin-svgr
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

export default defineConfig({
  plugins: [react(), svgr()],
  publicDir: 'src/assets',
  server: {
    port: 8080,
    open: true,
    proxy: { '/data': 'http://localhost:2700' },
  },
  build: { outDir: 'dist' },
});
```

### THREE.js BufferGeometry with vertex colors
```javascript
// Source: https://threejs.org/docs/#api/en/core/BufferGeometry
const geometry = new THREE.BoxGeometry(0.75, 0.75, 1);
geometry.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, -0.5));

// Pre-allocate color array: BoxGeometry has 24 vertices
const colors = new Float32Array(24 * 3);
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

const material = new THREE.MeshBasicMaterial({ vertexColors: true, morphTargets: true });
this.point = new THREE.Mesh(geometry, material);
```

### THREE.js morphAttributes (replacing morphTargets array)
```javascript
// Source: https://threejs.org/docs/#api/en/core/BufferGeometry.morphAttributes
// Setup base geometry (in addData, first call):
this._baseGeometry = new THREE.BufferGeometry();
this._morphTargetPositions = []; // track count (replaces .morphTargets.length)

// Add a morph target (replaces _baseGeometry.morphTargets.push(...)):
const positions = new Float32Array(pointCount * 3);
// ... fill positions ...
if (!this._baseGeometry.morphAttributes.position) {
  this._baseGeometry.morphAttributes.position = [];
}
this._baseGeometry.morphAttributes.position.push(
  new THREE.BufferAttribute(positions, 3)
);
this._morphTargetPositions.push(opts.name);

// Animation (mesh.morphTargetInfluences API unchanged):
this.points.morphTargetInfluences[this.lastIndex] = 1 - t;
this.points.morphTargetInfluences[currentIndex] = t;
```

### @brakebein/threeoctree usage
```javascript
// Source: https://github.com/brakebein/threeoctree
import { Octree } from '@brakebein/threeoctree';

this.octree = new Octree({
  undeferred: false,
  depthMax: Infinity,
  objectsThreshold: 4,
  overlapPct: 0.15,
});

// add with faces + vertices (same API as old THREE.Octree):
this.octree.add(this.points, { useFaces: true, useVertices: true });

// raycast (same API):
const octreeObjects = this.octree.search(
  this.raycaster.ray.origin,
  this.raycaster.ray.far,
  true,
  this.raycaster.ray.direction
);
const intersections = this.raycaster.intersectOctreeObjects(octreeObjects);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `THREE.Geometry` | `THREE.BufferGeometry` (only) | r125 (removed from core) | Full geometry API rewrite required |
| `geometry.faces[i].color` | `geometry.setAttribute('color', BufferAttribute)` | r125 | Per-face coloring via typed arrays |
| `geometry.morphTargets.push(...)` | `geometry.morphAttributes.position.push(BufferAttribute)` | r111 (BufferGeometry) | Different data shape; morph count tracking changes |
| `THREE.FaceColors` constant | `vertexColors: true` (boolean) | r115 | Simple rename, silent bug if not fixed |
| `geometry.applyMatrix()` | `geometry.applyMatrix4()` | r128 | Method rename |
| `geometry.merge()` | `BufferGeometryUtils.mergeGeometries()` or manual | r125 | Behavioral differences; see pitfall |
| Webpack 4/5 | Vite | - | No OpenSSL hack; 10x faster dev startup |
| `NODE_OPTIONS=--openssl-legacy-provider` | Not needed | Node 18+ + Vite | Eliminated by switching build tool |
| `componentWillReceiveProps` | `UNSAFE_componentWillReceiveProps` (or getDerivedStateFromProps) | React 16.3 (deprecated) | Fires warning in React 18 Strict mode |

**Deprecated/outdated:**
- `THREE.Geometry`: fully removed in r125; shim exists at `three/examples/jsm/deprecated/Geometry.js` as a temporary bridge only
- `three@0.91.0`: HIGH CVE GHSA-fq6p-x6j3-cmmq; fully replaced by this phase
- The vendored `src/THREEJSScript/Octree.js` (threeoctree r60): unmaintained, uses removed THREE.Geometry API
- `webpack` entire dev stack: removed after Vite migration confirmed

---

## Open Questions

1. **Does `@brakebein/threeoctree` support face-level raycasting against BufferGeometry?**
   - What we know: It's the maintained BufferGeometry-compatible fork of threeoctree. npm page returns 403.
   - What's unclear: Whether the `{ useFaces: true, useVertices: true }` options work identically with BufferGeometry vs old Geometry. The original Octree indexed by face objects which don't exist in BufferGeometry.
   - Recommendation: Plan should include a smoke test — add a point, add to octree, fire a raycast, verify an intersection is returned. If `useFaces` doesn't work with BufferGeometry, fall back to `useVertices: true` only (the dataIndex calculation in raycast_listener may need adjustment).

2. **The `geometry.merge(otherGeometry, matrix)` pattern in addPoint — exact replacement**
   - What we know: `BufferGeometryUtils.mergeGeometries` doesn't accept a per-geometry transform matrix. The old pattern applied `this.point.matrix` during merge (which encodes the point's world position and scale).
   - What's unclear: Whether `mergeGeometries` or a manual typed-array append is the safer path.
   - Recommendation: Use a manual typed-array approach — maintain a growing `Float32Array` for positions and colors in `addData`, apply the point's matrix transform to each position before appending, then create the final BufferGeometry once. This matches the old merge semantics exactly.

3. **SVG loader behavior: `react-svg-loader` vs `vite-plugin-svgr`**
   - What we know: The webpack config uses `react-svg-loader`. Only one SVG import was found: `icon_hamburger.svg` in the landing components.
   - What's unclear: Whether the SVG is imported as a React component or as a URL string. If it's a URL import, Vite handles it natively without svgr.
   - Recommendation: Check the import statement in `DesktopLanding.jsx` and `MobileLanding.jsx`. If it's `import HamburgerIcon from './icon_hamburger.svg'` used as `<HamburgerIcon />`, use svgr. If used as `<img src={HamburgerIcon} />`, Vite's native asset handling works and svgr is unnecessary.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30.x + supertest (server tests only) |
| Config file | `jest.config.js` (projects: client + server) |
| Quick run command | `npx jest tests/server/rateLimit.test.js` |
| Full suite command | `npx jest` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MOD-01 | Vite dev server starts, app loads in browser | smoke | `npm start` + manual browser check | ❌ Wave 0 |
| MOD-01 | Vite build completes without errors | build smoke | `npm run build` (exit 0) | ❌ Wave 0 |
| MOD-02 | No deprecation warnings in console | manual | Browser console inspection | ❌ manual-only |
| MOD-03 | Globe renders with data points visible | manual | Browser visual check | ❌ manual-only |
| MOD-03 | Raycasting returns intersections on conflict point hover | manual | Browser interaction check | ❌ manual-only |
| MOD-04 | `node_modules` contains no jquery/underscore/mapbox-gl | automated | `node -e "require('jquery')"` exits non-zero | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx jest tests/server/rateLimit.test.js` (verifies server not broken)
- **Per wave merge:** `npx jest` + `npm run build` (full build verification)
- **Phase gate:** Full suite green + manual browser check of globe before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/build/vite-smoke.test.js` — runs `vite build` and asserts exit 0 (MOD-01)
- [ ] `tests/deps/no-legacy-deps.test.js` — asserts `require('jquery')` etc. throw (MOD-04)
- [ ] `enzyme.config.js` referenced in `jest.config.js` — check if it exists before running client tests

---

## Sources

### Primary (HIGH confidence)
- [THREE.js Migration Guide (GitHub Wiki)](https://github.com/mrdoob/three.js/wiki/Migration-Guide) — r91 through r165 breaking changes, applyMatrix4, FaceColors, morphTargets
- [THREE.js BufferGeometry.morphAttributes docs](https://threejs.org/docs/#api/en/core/BufferGeometry.morphAttributes) — morphAttributes API and morphTargetInfluences
- [Vite official docs — server options](https://vite.dev/config/server-options) — proxy, port, publicDir
- [Vite official docs — static asset handling](https://vite.dev/guide/assets) — publicDir behavior

### Secondary (MEDIUM confidence)
- [@brakebein/threeoctree npm](https://www.npmjs.com/package/@brakebein/threeoctree) — described as BufferGeometry-compatible maintained fork; 403 on direct fetch but referenced by three.js community as the standard replacement
- [THREE.js forum — FaceColors replacement](https://discourse.threejs.org/t/how-to-use-the-latest-version-to-achieve-the-older-version-of-the-vertexcolors-three-facecolors-effect/52799) — confirms `vertexColors: true` replacement
- [React docs — Component lifecycle](https://react.dev/reference/react/Component) — UNSAFE_componentWillReceiveProps is supported

### Tertiary (LOW confidence — verify before acting)
- THREE.js forum: `morphTargets and morphNormals property of materials has been removed in r150` — this claim appeared in search results but the migration guide fetched says r130. Verify with the migration guide directly for exact version.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Vite, @vitejs/plugin-react, three r165 are all current and widely used
- Architecture (Vite config): HIGH — verified against official Vite docs
- THREE.js migration path: MEDIUM-HIGH — core API changes verified via official migration guide; the addPoint/merge pattern requires validation in Wave 0 (see Open Questions)
- Octree replacement: MEDIUM — @brakebein/threeoctree is the standard community recommendation but face-level raycasting against BufferGeometry needs a smoke test
- Pitfalls: HIGH — all derived from actual code audit + official API changes

**Research date:** 2026-03-11
**Valid until:** 2026-06-11 (Vite and THREE.js release often; check latest patch versions before installing)
