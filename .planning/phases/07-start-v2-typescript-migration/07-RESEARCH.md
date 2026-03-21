# Phase 7: Start v2 TypeScript Migration - Research

**Researched:** 2026-03-21
**Domain:** TypeScript migration — React 18 functional components, Redux hooks, Vite, Jest 30, Express/Knex server
**Confidence:** HIGH (standard stack well-documented; pitfalls verified against multiple authoritative sources)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Full stack: both `src/` (39 JSX + 12 JS) and `server/` (21 JS files) converted
- Test files (17 existing .test.js) converted to .test.ts
- Vendored THREE.js scripts (`src/THREEJSScript/EffectComposer.js`, `Octree.js`) converted to .ts (not left as .js with declarations)
- Incremental, proper types — each file gets real types, no blanket `any`
- Inside-out order: Redux (actions, reducers, store) → utils/api → data dictionaries → components → server
- Mixed codebase during migration: `allowJs: true` in tsconfig, converted .ts/.tsx files coexist with unconverted .js/.jsx files
- Each plan converts a layer; app works throughout
- `strict: true` from day one (noImplicitAny, strictNullChecks, strictFunctionTypes, strictPropertyInitialization)
- Hard spots use targeted `@ts-expect-error` with a comment explaining WHY — no blanket `any`, no implicit escape hatches
- All 39 class components converted to functional components + hooks during the TypeScript migration
- Includes GlobeVisual.jsx (THREE.js scene) — useRef for THREE objects, useEffect for animation loop
- Redux modernized: replace connect() + mapStateToProps with useSelector/useDispatch hooks
- Container/presentational split eliminated — components access store directly via hooks
- Three-layer regression approach applied after each conversion layer:
  1. Existing tests + build check: Run all 17 test suites, `tsc --noEmit`, Vite build must succeed
  2. Snapshot tests: Add React Test Renderer snapshot before converting each component; diff after conversion catches regressions
  3. Manual smoke test: Formalized checklist run per layer (landing, globe, routes, charts, navigation, API)
- React Test Renderer for snapshots (not Enzyme — unmaintained, React 18 issues)
- Formalized smoke test checklist defined and run after each conversion layer

### Claude's Discretion
- Exact tsconfig.json configuration details (module resolution, target, paths)
- Vite TypeScript plugin configuration
- Type definition organization (separate `types/` directory vs co-located)
- How to structure shared types between frontend and server
- Smoke test checklist items (specific pages/interactions to verify)
- Whether to use Redux Toolkit or keep vanilla Redux with TypeScript

### Deferred Ideas (OUT OF SCOPE)
- React Testing Library component integration tests (MOD-V2-02) — separate phase after TypeScript migration
- Redux Toolkit migration — could happen during TS conversion but not required
- Country-level data completeness indicator on globe (FEAT-V2-01) — separate feature phase
- Offline support / cached data fallback (FEAT-V2-02) — separate feature phase
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MOD-V2-01 | TypeScript migration for Redux and data layer | Core of this phase — typed Redux store, action creators, reducers, typed API responses, typed data dictionaries |
| MOD-V2-02 | React Testing Library component integration tests | Out of scope for this phase per CONTEXT.md; React Test Renderer snapshots are the regression tool here (RTL comes next) |
</phase_requirements>

---

## Summary

This phase converts a ~90-file JavaScript codebase (39 JSX components, 12 src JS files, 21 server JS files, 17 test files) to TypeScript with `strict: true`. The migration spans three distinct layers: a Vite-bundled React 18 frontend using Redux 4, a Node.js/Express backend using CommonJS `require`, and a Jest 30 test suite using its own transform config.

The dominant challenge is that the frontend and server have fundamentally different module systems. The frontend already uses ES modules (Vite handles this); the server uses CommonJS `require`. TypeScript can handle both, but they need different tsconfig targets: `moduleResolution: "bundler"` for Vite's frontend, `moduleResolution: "node16"` (or `node`) for the Node.js server. A two-tsconfig approach (tsconfig.json for frontend, tsconfig.server.json for server) is the standard pattern and must be used here.

The second major challenge is the class-to-functional conversion. GlobeContainer.jsx at 1,000+ lines with deep THREE.js imperative refs, `this.gv`, Promise chains in componentDidMount, and multiple bound methods represents the most complex conversion in the codebase. All `this.gv.*` calls must become typed `useRef<GlobeVisual>()` accesses inside useEffect/callbacks. The conversion order (inside-out, Redux first) ensures that by the time components are converted, their type dependencies are already defined.

**Primary recommendation:** Install TypeScript 5.9.3 + ts-jest 29.4.6 + typed definitions for all major libraries in Wave 0. Use two tsconfig files (frontend + server). Convert Redux layer first so all component type consumers exist before component conversion begins. GlobeContainer is the highest-risk conversion — prototype it early and snapshot it before touching.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| typescript | 5.9.3 | Type checker + language | Current stable; strict: true from day one |
| ts-jest | 29.4.6 | Jest transform for .ts/.tsx tests | Official Jest TypeScript transformer; major version mirrors Jest |
| @types/react | 19.2.14 | React type definitions | Ships with React 18 support; required for TSX |
| @types/node | 25.5.0 | Node.js global types | Required for server-side TS |

### Frontend Type Definitions
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/three | 0.183.1 | THREE.js types | Pin to match three@0.165.0 in package.json |
| @types/react-redux | 7.1.34 | Redux hooks types | Provides RootState, AppDispatch, useSelector/useDispatch generics |
| @types/lodash | 4.17.24 | Lodash types | Used extensively in GlobeContainer |
| @types/d3 | 7.4.3 | D3 types | Used in GlobeContainer for scale functions |
| @types/react-router-dom | 5.3.3 | Router types | useNavigate, useParams, useLocation generics |

### Server Type Definitions
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/express | 5.0.6 | Express Request/Response types | All Express route handlers |
| @types/pg | 8.20.0 | PostgreSQL client types | Used in Knex connection setup |

### No Separate Types Needed (bundled)
| Library | Note |
|---------|------|
| styled-components 6.x | Ships built-in TypeScript types — no `@types/styled-components` needed |
| react-router-dom 6.x | Has built-in types (but @types/react-router-dom still needed for v6 compat) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ts-jest | @swc/jest (SWC transform) | SWC is faster but ts-jest provides full type checking in tests; alignment with tsc behavior is more important here than speed |
| vanilla Redux + useSelector/useDispatch | Redux Toolkit | RTK is modern best practice but adding it is a separate concern — locked as deferred |
| Two tsconfig files | Single tsconfig with paths | Two configs is the only way to handle the frontend/server module system split correctly |

**Installation (Wave 0):**
```bash
npm install --save-dev typescript ts-jest @types/react @types/node @types/three @types/react-redux @types/lodash @types/d3 @types/react-router-dom @types/express @types/pg react-test-renderer @types/react-test-renderer
```

**Version verification:** All versions above confirmed against npm registry on 2026-03-21.

---

## Architecture Patterns

### Recommended Project Structure (additions to existing layout)
```
refugee-flow/
├── tsconfig.json             # Frontend: Vite/React, moduleResolution: bundler
├── tsconfig.server.json      # Server: Node.js, moduleResolution: node
├── src/
│   ├── types/                # Shared frontend types
│   │   ├── redux.ts          # RootState, AppDispatch, pre-typed hooks
│   │   ├── api.ts            # API response shapes
│   │   └── war.ts            # War/conflict domain types
│   ├── redux/                # Convert first: actionConstants.ts, actions/*.ts, reducers/*.ts, store.ts
│   ├── utils/                # Convert second: api.ts, color-conversion-algorithms.ts
│   ├── data/                 # Convert third: routeDictionary.ts, warDictionary.ts
│   └── components/           # Convert fourth (inside-out within folder)
└── server/
    └── types/                # Server-side shared types
        ├── knex.ts           # Database row types
        └── ingestion.ts      # Ingestion result types
```

### Pattern 1: tsconfig.json (Frontend — Vite)

Use `moduleResolution: "bundler"` for Vite. Vite transpiles TS but does NOT type-check — type checking is via `tsc --noEmit` in CI/validation step.

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "allowJs": true,
    "checkJs": false,
    "noEmit": true,
    "esModuleInterop": true,
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "server"]
}
```

**Key choices:**
- `moduleResolution: "bundler"` — required for Vite; allows extension-less imports that bundlers handle
- `allowJs: true` + `checkJs: false` — JS files coexist but are not type-checked (unconverted files stay safe)
- `noEmit: true` — Vite handles emit; tsc is only for type checking
- `allowImportingTsExtensions: true` — required when `noEmit: true` + bundler resolution

### Pattern 2: tsconfig.server.json (Server — Node.js CommonJS)

The server uses `require()` (CommonJS). It must use `moduleResolution: "node"` (or `node16`), NOT `bundler`.

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "node",
    "strict": true,
    "allowJs": true,
    "checkJs": false,
    "noEmit": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "lib": ["ES2020"],
    "types": ["node"]
  },
  "include": ["server/**/*"],
  "exclude": ["node_modules", "dist", "src"]
}
```

### Pattern 3: Redux Typed Store and Pre-typed Hooks

This pattern is the critical foundation — must exist before any component conversion.

```typescript
// src/redux/store.ts
import { createStore } from 'redux';
import reducer from './reducers/reducer';

export const store = createStore(
  reducer,
  (process.env.NODE_ENV !== 'production' && (window as any).__REDUX_DEVTOOLS_EXTENSION__)
    ? (window as any).__REDUX_DEVTOOLS_EXTENSION__()
    : undefined,
);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

```typescript
// src/types/redux.ts  — pre-typed hooks (avoids circular import)
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../redux/store';

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

### Pattern 4: Typed Action Creators

```typescript
// src/redux/actions/conflictActions.ts
import constants from '../actionConstants';

export interface SetSelectedYearAction {
  type: typeof constants.SET_SELECTED_YEAR;
  selectedYearIndex: number;
}

export interface SetCurrentCountryAction {
  type: typeof constants.SET_CURRENT_COUNTRY;
  currentCountry: string;
}

export type ConflictAction = SetSelectedYearAction | SetCurrentCountryAction;

export const setSelectedYear = (selectedYearIndex: number): SetSelectedYearAction => ({
  type: constants.SET_SELECTED_YEAR,
  selectedYearIndex,
});

export const setCurrentCountry = (currentCountry: string): SetCurrentCountryAction => ({
  type: constants.SET_CURRENT_COUNTRY,
  currentCountry,
});
```

### Pattern 5: Class to Functional + Hooks (Standard Component)

The connect() + mapStateToProps pattern becomes useAppSelector/useAppDispatch + direct hook usage:

```typescript
// BEFORE (class + connect)
class GlobeTimeline extends React.Component<Props, State> { ... }
const mapStateToProps = (state: RootState) => ({ selectedYear: state.conflictReducer.selectedYear });
export default connect(mapStateToProps)(GlobeTimeline);

// AFTER (functional + hooks)
const GlobeTimeline: React.FC<Props> = ({ onClickYear, onClickQuater, currentYear, years }) => {
  const selectedYear = useAppSelector(state => state.conflictReducer.selectedYear);
  const dispatch = useAppDispatch();
  // ...
};
export default GlobeTimeline;
```

### Pattern 6: GlobeVisual / GlobeContainer — THREE.js with useRef

GlobeVisual is a class component that exposes imperative methods (`this.gv.animate()`, `this.gv.addData()`, `this.gv.transition()`). GlobeContainer holds a `ref = {gv => this.gv = gv}` and calls these methods. In the functional conversion:

**GlobeVisual becomes a component with forwardRef + useImperativeHandle:**

```typescript
// src/components/globe/GlobeVisual.tsx
export interface GlobeVisualHandle {
  animate: () => void;
  addData: (data: unknown[], opts: AddDataOpts) => void;
  transition: (index: number, cb?: () => void) => void;
  createPoints: (data: unknown[]) => void;
  setTarget: (latLng: [number, number], zoom: number) => void;
  zoom: (delta: number) => void;
  octree: OctreeHandle;
  scene: THREE.Scene;
  camera: THREE.Camera;
  scaler: d3.ScaleLinear<number, number>;
  points: THREE.Points;
}

const GlobeVisual = React.forwardRef<GlobeVisualHandle, GlobeVisualProps>((props, ref) => {
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene>(new THREE.Scene());
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    animate: () => { /* start animation loop */ },
    // ... other methods
  }));

  useEffect(() => {
    // THREE.js init here: renderer, camera, scene, event listeners
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current = renderer;
    containerRef.current?.appendChild(renderer.domElement);

    return () => {
      // CRITICAL: cleanup to prevent memory leaks
      renderer.dispose();
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, []); // empty deps = runs once on mount

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
});
GlobeVisual.displayName = 'GlobeVisual';
```

**GlobeContainer uses the ref:**

```typescript
const GlobeContainer: React.FC = () => {
  const globeRef = useRef<GlobeVisualHandle>(null);
  // ...
  const handleYearClick = useCallback((year: string) => {
    globeRef.current?.transition(5, () => { /* ... */ });
  }, []);

  return <GlobeVisual ref={globeRef} opts={opts} rotatePause={rotatePause} />;
};
```

### Pattern 7: Express Route Handler Typing

```typescript
// server/routes/dataRoute.ts
import { Router, Request, Response } from 'express';
import { getWarData } from '../controllers/api/data/dataController';

const router = Router();

router.get('/reduced_war_data', async (req: Request, res: Response): Promise<void> => {
  const data = await getWarData();
  res.json(data);
});

export default router;
```

### Pattern 8: Knex Typed Queries

Knex 3.x has built-in TypeScript support via generic type parameters. No separate wrapper library needed.

```typescript
// server/database/connection.ts
import knex from 'knex';

export interface WarEvent {
  id: number;
  lat: number;
  lng: number;
  fat: number;
  evt: number;
  cot: string[];
  int: number;
  year: string;
  quarter: string;
}

const db = knex({ client: 'pg', connection: { /* ... */ } });

// Typed query
const events = await db<WarEvent>('war_events').where({ year: '2023' });
// events is typed as WarEvent[]
```

### Pattern 9: ts-jest Configuration (Jest config update)

The existing `jest.config.js` uses two projects (client, server). Each project needs a `transform` entry for TypeScript.

```javascript
// jest.config.js (updated)
module.exports = {
  projects: [
    {
      displayName: 'client',
      testMatch: ['<rootDir>/tests/client/**/*.test.{ts,tsx,js,jsx}', '<rootDir>/src/**/*.test.{ts,tsx,js,jsx}'],
      moduleNameMapper: {
        '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga|css|scss)$': 'babel-jest',
      },
      transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
        '^.+\\.(js|jsx)$': 'babel-jest',
      },
      setupFilesAfterEnv: ['<rootDir>/enzyme.config.js'],
      testEnvironment: 'jsdom',
    },
    {
      displayName: 'server',
      testMatch: ['<rootDir>/tests/server/**/*.test.{ts,js}'],
      testEnvironment: 'node',
      transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.server.json' }],
        '^.+\\.js$': 'babel-jest',
      },
    },
  ],
};
```

**Note:** The server tests currently use `require()` (CommonJS). When converting tests to .ts, the server tsconfig uses `module: "CommonJS"` so `require` interop continues to work via `esModuleInterop`.

### Anti-Patterns to Avoid

- **Single tsconfig for both frontend and server:** The frontend needs `moduleResolution: "bundler"` (Vite), the server needs `moduleResolution: "node"` (CommonJS require). Mixing them in one config breaks either Vite or the server transforms.
- **`checkJs: true` on unconverted JS files:** This will produce hundreds of errors on the ~50 files not yet converted. Leave `checkJs: false` during migration; run `tsc --noEmit` which respects allowJs without checking JS.
- **Removing Enzyme before class conversion is complete:** The 17 existing tests use Jest/Enzyme patterns. Enzyme must stay operational until tests are converted (or tests are updated to not use Enzyme shallow/mount).
- **Converting GlobeContainer and GlobeVisual in the same plan:** These two are deeply coupled via the `this.gv` ref. GlobeVisual must be converted with `forwardRef + useImperativeHandle` first, then GlobeContainer can safely convert.
- **Using `any` in Redux state types:** The `RootState` type must be properly derived from the store. `any` in the state type propagates unsafety to every `useAppSelector` call.
- **Not creating the pre-typed hooks file before component conversion:** If components import `useDispatch`/`useSelector` directly without `AppDispatch`/`RootState` generics, TypeScript cannot verify the dispatch call shapes. The `src/types/redux.ts` file must exist before a single component is converted.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Typed Redux hooks | Custom selector/dispatch wrappers | `TypedUseSelectorHook` + pre-typed hooks in `src/types/redux.ts` | React Redux 7.x has the full generic machinery; custom versions miss edge cases |
| THREE.js imperative instance exposure to parent | Complex prop callbacks or global refs | `React.forwardRef` + `useImperativeHandle` | The only React-safe way to expose imperative handles; anything else breaks with concurrent React |
| Type-safe Knex queries | Custom query builder | `db<RowType>('table_name')` with Knex generics | Knex 3.x has built-in generics; @wwwouter/typed-knex is deprecated |
| Test transforms for TypeScript | Custom babel config for TS | `ts-jest` with project-scoped tsconfig | ts-jest provides source map support and accurate error locations in test output |
| Airbnb ESLint for TypeScript | Manually adding @typescript-eslint rules | `eslint-config-airbnb-typescript` + `@typescript-eslint/eslint-plugin` | Pre-built extension that adds TS-specific Airbnb rules on top of existing config |
| Snapshot regression test tooling | Manual DOM diffing | `react-test-renderer` + `.toMatchSnapshot()` | Jest built-in snapshot infrastructure handles storage, diffing, updates |

**Key insight:** TypeScript's value is in compiler-verified contracts between modules. The moment you use `any` as a type, you void the contract at that boundary and all downstream consumers. `@ts-expect-error` is preferable to `any` because it's explicit, searchable, and auto-errors if the TS problem it suppresses is later fixed (it becomes a compiler error about an unused suppression).

---

## Common Pitfalls

### Pitfall 1: `allowJs: true` Does Not Mean JS Files Are Type-Safe
**What goes wrong:** Developer adds `allowJs: true` expecting TypeScript to catch errors in still-unconverted `.js` files.
**Why it happens:** `allowJs` means "include JS files in the compilation" not "check JS files." Type errors in JS are only reported if `checkJs: true` is also set (which would flood the migration with hundreds of pre-existing errors).
**How to avoid:** Keep `checkJs: false` throughout migration. Only converted `.ts`/`.tsx` files are type-checked. Run `tsc --noEmit` to validate only TS files.
**Warning signs:** Expecting TS errors in `.js` files and not seeing them is correct behavior, not a misconfiguration.

### Pitfall 2: The Two tsconfig Problem — Vite Cannot Use `moduleResolution: node`
**What goes wrong:** Using a single tsconfig with `moduleResolution: "node"` causes Vite to not resolve `@types` packages correctly and breaks imports without explicit `.js` extensions. Using `moduleResolution: "bundler"` in the server tsconfig causes `require()` to not be understood by the checker.
**Why it happens:** Vite and Node.js have different module resolution rules. Vite handles extension-less relative imports, Node.js CommonJS doesn't.
**How to avoid:** Two tsconfig files from the start. `tsc --noEmit` (frontend) and `tsc --noEmit --project tsconfig.server.json` (server) as separate validation commands.
**Warning signs:** `ts-jest` test errors about missing `require` or import resolution failures in server tests indicate wrong tsconfig is being used.

### Pitfall 3: `@types/three` Version Must Match `three` Package Version
**What goes wrong:** Installing latest `@types/three` (0.183.x) with `three@0.165.0` (pinned exact in package.json) produces type mismatches for APIs that changed between versions.
**Why it happens:** `@types/three` versions loosely correspond to `three` major/minor versions. The project pins `three@0.165.0` exactly due to geometry API constraints from Phase 2.
**How to avoid:** Install `@types/three@0.165.0` (or the closest compatible version to 0.165). Use `npm view @types/three versions --json | grep "0.165"` to find the right match. Do not install a newer @types/three.
**Warning signs:** TypeScript errors on THREE APIs that definitely exist in 0.165 signal a version mismatch.

### Pitfall 4: withRouter6 HOC — Convert Components That Use It Last Within Their Layer
**What goes wrong:** Converting a component that uses `withRouter6` before converting `withRouter6.jsx` itself results in type errors because the HOC is still untyped.
**Why it happens:** `withRouter6` is a React Router HOC that injects `navigate`, `location`, `params` props. Until it's typed, consuming components that destructure those props will have `any` types.
**How to avoid:** Convert `withRouter6.jsx → withRouter6.tsx` in the router layer before any component that uses it. The HOC becomes unnecessary during class-to-functional conversion — components using `useNavigate`/`useParams` directly can delete the HOC wrapper.
**Warning signs:** Props typed as `any` in a component that uses `withRouter6` signal this ordering issue.

### Pitfall 5: Class Component `ref` Pattern Changes Completely
**What goes wrong:** Converting `GlobeContainer` without first converting `GlobeVisual` leaves a `React.createRef()` pointing at a class instance that no longer exists.
**Why it happens:** In the class component, `ref = {gv => this.gv = gv}` captured the class instance, giving access to all class methods. Functional components have no instance — the `ref` points at a DOM node unless `forwardRef` + `useImperativeHandle` is used.
**How to avoid:** Always convert the referenced component (GlobeVisual) before the referencing component (GlobeContainer). GlobeVisual gets `forwardRef<GlobeVisualHandle>` with an explicit interface for every method GlobeContainer calls.
**Warning signs:** `this.gv.animate is not a function` or TypeScript error `Property 'animate' does not exist on type 'never'` after partial conversion.

### Pitfall 6: Server Tests Use `require()` — Cannot Mix with TS ES Module Import
**What goes wrong:** Converting a server test to `.ts` and using `import` syntax while the source file is still `.js` using `module.exports` fails at the CommonJS/ESM boundary.
**Why it happens:** Jest runs in Node.js CommonJS mode by default. When a `.ts` test file uses `import`, ts-jest transpiles it — but if `module: "CommonJS"` is set in `tsconfig.server.json`, the output is `require()`. This works if the source file also uses `module.exports`. Breaks only if source migrates to ESM export before the `module` setting is updated.
**How to avoid:** Keep server tsconfig at `module: "CommonJS"` throughout migration. Convert server source files to use `export`/`import` syntax (TypeScript ES module syntax), but ts-jest's CommonJS output means the emitted code still uses `require`. Only change module format if/when Node.js ESM is explicitly targeted.
**Warning signs:** `SyntaxError: Cannot use import statement in a module` in server tests during conversion.

### Pitfall 7: `strict: true` + Existing Redux Store — `window.__REDUX_DEVTOOLS_EXTENSION__` Has No Type
**What goes wrong:** `window.__REDUX_DEVTOOLS_EXTENSION__` is not in any standard type definition, so `strict: true` produces `Property '__REDUX_DEVTOOLS_EXTENSION__' does not exist on type 'Window & typeof globalThis'`.
**Why it happens:** It's a browser extension injected property, not part of the Web APIs spec.
**How to avoid:** Cast to `any` at that exact access point, or declare a module augmentation. `@ts-expect-error` is acceptable here since this is a known third-party injection:
```typescript
// @ts-expect-error -- Redux DevTools browser extension injects this at runtime
const devTools = window.__REDUX_DEVTOOLS_EXTENSION__;
```
**Warning signs:** This is the first error you'll see when converting `store.js`.

### Pitfall 8: `enzyme.config.js` Cannot be Typed Until Enzyme is Removed or Updated
**What goes wrong:** Enzyme 3.x does not have React 18 support. The `enzyme-adapter-react-16` references React 16 types which conflict with `@types/react` 18.x.
**Why it happens:** Enzyme is unmaintained and its adapter types are pinned to React 16.
**How to avoid:** The existing tests that use Enzyme should be converted to NOT use Enzyme during test file conversion. The snapshot approach uses `react-test-renderer`, not Enzyme. Enzyme setup file stays as `.js` (using `allowJs: true`) until the last Enzyme test is removed — at that point, `enzyme.config.js` is deleted.
**Warning signs:** TypeScript errors in `enzyme.config.js` are expected and acceptable since it remains `.js` throughout migration.

---

## Code Examples

Verified patterns from official documentation and community sources:

### Pre-typed Redux Hooks (React Redux 7.x)
```typescript
// Source: https://react-redux.js.org/using-react-redux/usage-with-typescript
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../redux/store';

// Use these throughout the app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

### THREE.js useRef Pattern
```typescript
// Source: https://discourse.threejs.org/t/how-to-use-the-react-function-useref-with-reactjs-and-three-js/26378
const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
const sceneRef = useRef<THREE.Scene | null>(null);

useEffect(() => {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  rendererRef.current = renderer;
  // cleanup
  return () => { renderer.dispose(); };
}, []);
```

### forwardRef with useImperativeHandle
```typescript
// Source: React docs — https://react.dev/reference/react/useImperativeHandle
interface Handle {
  focus: () => void;
}
const MyInput = React.forwardRef<Handle, Props>((props, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }));
  return <input ref={inputRef} />;
});
```

### React Test Renderer Snapshot (TypeScript)
```typescript
// Source: https://jestjs.io/docs/tutorial-react
import React from 'react';
import renderer from 'react-test-renderer';
import MyComponent from '../MyComponent';

test('renders correctly', () => {
  const tree = renderer.create(<MyComponent prop="value" />).toJSON();
  expect(tree).toMatchSnapshot();
});
```

### Knex Typed Query
```typescript
// Source: https://knexjs.org/guide/ — built-in TypeScript support
interface RouteDeathRow {
  id: number;
  lat: number | null;
  lng: number | null;
  year: string;
  quarter: string;
  dead: string;
}

const rows = await db<RouteDeathRow>('route_deaths')
  .where({ year: '2023' })
  .select('id', 'lat', 'lng', 'dead');
// rows: RouteDeathRow[]
```

### Express Typed Route Handler
```typescript
// Source: https://stevekinney.com/courses/full-stack-typescript/adding-types-to-express
import { Request, Response, Router } from 'express';

const router = Router();

router.get('/note/:id', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params; // typed as string
  const data = await getNotes(parseInt(id, 10));
  res.json(data);
});
```

### @ts-expect-error for Known Hard Spots
```typescript
// Use for explicitly documented tech debt, not as a general escape hatch
// @ts-expect-error -- THREE.EffectComposer is vendored JS with no declaration file; typed manually below
import EffectComposer from '../THREEJSScript/EffectComposer';
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `connect()` + mapStateToProps | `useSelector` + `useDispatch` hooks | React Redux 7.1.0 (2019), firmly standard by 2021 | Dramatically simpler TypeScript integration; types inferred from store |
| Enzyme for React testing | React Testing Library / react-test-renderer | RTL became dominant ~2020; Enzyme deprecated ~2023 | Enzyme has no React 18 adapter; snapshots use react-test-renderer |
| `@types/*` for all libraries | Many libraries ship own types | Ongoing since 2018 | styled-components v6 ships types; check before installing @types package |
| Single tsconfig | Split tsconfig (app + server) | Industry best practice since TS 2.x project references | Required when frontend and server have different module systems |
| `moduleResolution: "node"` | `moduleResolution: "bundler"` for Vite projects | TypeScript 5.0 (2023) | "bundler" is the correct mode for Vite; "node" was the previous default |
| `babel-eslint` parser | `@typescript-eslint/parser` | eslint-config-airbnb-typescript emerged ~2019 | babel-eslint is deprecated; TS-specific rules require the TS parser |

**Deprecated/outdated:**
- `enzyme` + `enzyme-adapter-react-16`: No React 18 support; use react-test-renderer for snapshots per locked decision
- `babel-eslint` as parser in `.eslintrc`: Deprecated in favor of `@typescript-eslint/parser`; must be replaced when TypeScript ESLint rules are added
- `@wwwouter/typed-knex`: Deprecated wrapper; use Knex 3.x built-in generics instead
- `@types/styled-components`: Not needed for styled-components v6 (types bundled)

---

## Open Questions

1. **`@types/three` exact version to install**
   - What we know: `three` is pinned at `0.165.0` exactly; `@types/three` latest is `0.183.1`
   - What's unclear: Whether `@types/three@0.165.0` exists as a package, or what the closest version is without regressions
   - Recommendation: Run `npm view @types/three versions --json` to find a `0.165.x` or `0.166.x` version. If no `0.165.x` exists, install `@types/three@0.165.0` may install a stub — validate with `tsc --noEmit` immediately after.

2. **ESLint migration: flat config vs legacy `.eslintrc`**
   - What we know: Project uses `.eslintrc` (legacy format); ESLint 10.x (installed) supports both; `babel-eslint` must be replaced with `@typescript-eslint/parser`
   - What's unclear: Whether to migrate to ESLint flat config at the same time as TypeScript, or keep legacy format
   - Recommendation: Keep `.eslintrc` (legacy format) during migration to minimize change surface. Add `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin` + `eslint-config-airbnb-typescript` additions to the existing `.eslintrc`.

3. **GlobeVisual's Octree dependency**
   - What we know: Octree import is disabled via comment in GlobeVisual.jsx ("Octree disabled — @brakebein/threeoctree useFaces on large merged BufferGeometry causes browser crash"). GlobeContainer still calls `this.gv.octree.update()` and `this.gv.octree.remove()`.
   - What's unclear: Whether `octree` is accessed at runtime (which would crash) or these calls are dead code
   - Recommendation: Audit GlobeContainer to confirm octree usage status before converting. If `octree.update` and `octree.remove` are live, the `GlobeVisualHandle` interface needs an `octree` property of appropriate type.

---

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — this section is required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30.3.0 |
| Config file | `jest.config.js` (two-project: client + server) |
| Quick run command | `npm test -- --testPathPattern="tests/server/db-connection"` |
| Full suite command | `npm test` |
| Type check command | `tsc --noEmit && tsc --noEmit --project tsconfig.server.json` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MOD-V2-01 | Redux layer types compile without errors | build check | `tsc --noEmit` | Wave 0: needs tsconfig.json |
| MOD-V2-01 | Server layer types compile without errors | build check | `tsc --noEmit --project tsconfig.server.json` | Wave 0: needs tsconfig.server.json |
| MOD-V2-01 | Converted files pass existing server tests | unit | `npm test -- --testPathPattern="tests/server"` | Partially — 17 tests exist as .js |
| MOD-V2-01 | Vite build succeeds after each conversion layer | build check | `npm run build` | Command exists |

### Sampling Rate
- **Per task commit:** `tsc --noEmit` (frontend) or `tsc --noEmit --project tsconfig.server.json` (server) + `npm test` for affected test project
- **Per wave merge:** Full `npm test` + `tsc --noEmit` both configs + `npm run build`
- **Phase gate:** Full suite green, zero TypeScript errors on all converted files, Vite build succeeds

### Wave 0 Gaps
- [ ] `tsconfig.json` — frontend TypeScript configuration (does not yet exist)
- [ ] `tsconfig.server.json` — server TypeScript configuration (does not yet exist)
- [ ] TypeScript and all @types packages installed (`npm install --save-dev typescript ts-jest ...`)
- [ ] `jest.config.js` updated with ts-jest transforms
- [ ] `src/types/redux.ts` — pre-typed hooks file (must exist before any component conversion)

---

## Sources

### Primary (HIGH confidence)
- React Redux official docs — https://react-redux.js.org/using-react-redux/usage-with-typescript (useSelector/useDispatch typing, TypedUseSelectorHook, pre-typed hooks pattern)
- TypeScript TSConfig Reference — https://www.typescriptlang.org/tsconfig/ (allowJs, checkJs, moduleResolution, noEmit options)
- Jest 30 official docs — https://jestjs.io/blog/2025/06/04/jest-30 (ts-jest compatibility, TS config support)
- Vite official docs — https://vite.dev/guide/features (Vite transpiles TS but does NOT type-check; noEmit pattern)
- React docs — https://react.dev/reference/react/useImperativeHandle (forwardRef + useImperativeHandle pattern)
- Jest snapshot testing — https://jestjs.io/docs/snapshot-testing (react-test-renderer pattern)
- npm registry (verified 2026-03-21): typescript@5.9.3, ts-jest@29.4.6, @types/react@19.2.14, @types/three@0.183.1, @types/react-redux@7.1.34, @types/lodash@4.17.24, @types/d3@7.4.3, @types/express@5.0.6, @types/node@25.5.0, @types/pg@8.20.0

### Secondary (MEDIUM confidence)
- styled-components docs — https://styled-components.com/docs/faqs (v6 ships own types; no @types package needed — verified against styled-components v6.3.11 in project)
- eslint-config-airbnb-typescript — https://github.com/iamturns/eslint-config-airbnb-typescript (note: original repo unmaintained; ESLint 9 compat is via fork `@kesills/eslint-config-airbnb-typescript`)
- Incremental migration pattern — https://www.mixmax.com/engineering/incremental-migration-from-javascript-to-typescript-in-our-largest-service (inside-out conversion strategy)

### Tertiary (LOW confidence — flag for validation)
- Vite + moduleResolution bundler pattern — corroborated by multiple sources but specific Vite version interaction with TypeScript 5.9.3 should be validated in Wave 0 tsconfig setup

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry 2026-03-21
- Architecture: HIGH — tsconfig split pattern + Redux typed hooks from official docs
- Pitfalls: HIGH for documented items; MEDIUM for GlobeVisual's Octree status (open question)
- Code examples: HIGH — all patterns from official React, Redux, THREE.js, Jest documentation

**Research date:** 2026-03-21
**Valid until:** ~2026-06-21 (TypeScript and @types packages update frequently; re-verify versions before installation)
