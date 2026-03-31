# Codebase Structure

**Analysis Date:** 2026-03-10

## Directory Layout

```
refugee-flow/
├── src/                           # Client-side React application
│   ├── components/                # React components organized by feature
│   │   ├── about/                 # About page and accordion components
│   │   ├── asylumApplication/     # Asylum application chart components
│   │   ├── globe/                 # Globe visualization components
│   │   ├── landing/               # Landing page (desktop/mobile)
│   │   ├── router/                # React Router configuration
│   │   │   └── config/            # Route registry
│   │   └── [component].jsx        # Top-level components
│   ├── redux/                     # Redux state management
│   │   ├── actions/               # Action creators
│   │   ├── reducers/              # Reducer functions
│   │   ├── defaultStates/         # Initial state definitions
│   │   ├── actionConstants.js     # Action type constants
│   │   └── store.js               # Redux store configuration
│   ├── utils/                     # Utility functions
│   │   ├── api.js                 # Fetch wrappers and API calls
│   │   └── color-conversion-algorithms.js
│   ├── styles/                    # Global styles
│   │   ├── main.scss              # Main stylesheet
│   │   ├── reset.scss             # CSS reset
│   │   └── fonts.css              # Font imports
│   ├── data/                      # Static JSON data files
│   │   ├── route_desc.json        # Route descriptions
│   │   ├── countries_states.json  # Country/state data
│   │   ├── cot_latLng.json        # Lat/lng coordinates
│   │   ├── IBC_crossingCountByCountry.json
│   │   ├── routeDictionary.js     # Route metadata
│   │   └── warDictionary.js       # War metadata
│   ├── assets/                    # Static assets
│   │   └── globe/                 # Globe-related assets
│   ├── THREEJSScript/             # THREE.js utilities
│   │   ├── EffectComposer.js
│   │   └── Octree.js
│   ├── index.jsx                  # React app entry point
│   └── index.template.html        # HTML template
├── server/                        # Express.js backend
│   ├── database/                  # Database layer
│   │   ├── Models.js              # Mongoose models
│   │   └── connection.js          # MongoDB connection
│   ├── controllers/               # Request handlers
│   │   └── api/
│   │       └── data/
│   │           ├── dataController.js     # Data fetch logic
│   │           └── helpers/
│   │               └── dataProcessors.js # Data transformation
│   ├── routes/                    # API routes
│   │   └── dataRoute.js           # /data/* endpoints
│   ├── helpers/                   # Server utilities
│   │   └── envInfo.js             # Environment logging
│   └── server.js                  # Express app entry point
├── webpack/                       # Webpack configuration
│   ├── webpack.common.js          # Shared config
│   ├── webpack.dev.js             # Development config
│   └── webpack.prod.js            # Production config
├── .planning/                     # Planning and analysis
│   └── codebase/                  # Codebase documentation
├── dist/                          # Built React application (generated)
├── node_modules/                  # Dependencies (generated)
├── package.json                   # Project manifest
├── package-lock.json              # Dependency lockfile
├── .babelrc                       # Babel configuration
├── .eslintrc                      # ESLint configuration
├── jest.config.js                 # Jest testing configuration
├── enzyme.config.js               # Enzyme testing setup
├── webpack.config.js              # Webpack configuration
├── config.js                      # Application config (secrets, ports)
├── config.example.js              # Config template
└── pm2.ecosystem.json             # PM2 deployment config
```

## Directory Purposes

**`src/components/`:**
- Purpose: React UI components organized by feature area
- Contains: JSX files implementing UI
- Key files: `Conflict.jsx`, `RefugeeRoute.jsx`, `Router.jsx`

**`src/components/about/`:**
- Purpose: About page content and accordion UI
- Contains: `About.jsx`, `Accordion.jsx`, `Paragraph.jsx`, accordion config

**`src/components/asylumApplication/`:**
- Purpose: Asylum application statistics visualization
- Contains: Chart components and container

**`src/components/globe/`:**
- Purpose: Interactive globe visualization for conflict data
- Contains: `GlobeContainer.jsx` (Redux-connected), `GlobeVisual.jsx` (THREE.js), `GlobeTimeline.jsx`, stats board, tooltips

**`src/components/landing/`:**
- Purpose: Landing page entry point
- Contains: `DesktopLanding.jsx` and `MobileLanding.jsx` for responsive design

**`src/components/router/`:**
- Purpose: Application routing configuration
- Contains: `Router.jsx` with route definitions, route registry

**`src/redux/`:**
- Purpose: Redux state management
- Contains: Store configuration, actions, reducers, default states, constants
- Pattern: Standard Redux action → reducer → store pattern

**`src/redux/actions/`:**
- Purpose: Action creators for state updates
- Contains: `conflictActions.js` with `setSelectedYear` and `setCurrentCountry`

**`src/redux/reducers/`:**
- Purpose: Pure functions that transform state
- Contains: `conflictReducer.js` and root `reducer.js` with combined reducers

**`src/utils/`:**
- Purpose: Reusable utility functions
- Contains: API fetch wrappers, color conversion helpers

**`src/data/`:**
- Purpose: Static JSON data and metadata
- Contains: Route/country/war dictionaries, coordinate mappings, crossing statistics

**`server/database/`:**
- Purpose: Database connectivity and models
- Contains: Mongoose models for wars and asylum applications, MongoDB connection handling

**`server/controllers/`:**
- Purpose: Request handlers and data retrieval logic
- Contains: Data controller functions that query models or load JSON files

**`server/routes/`:**
- Purpose: Express route definitions
- Contains: REST API endpoint definitions in `dataRoute.js`

**`webpack/`:**
- Purpose: Build tooling configuration
- Contains: Separate configs for development (hot reload) and production (minification)

## Key File Locations

**Entry Points:**
- `src/index.jsx`: Client-side React entry point (renders app with Redux Provider)
- `server/server.js`: Backend Express app entry point (listens on PORT)

**Configuration:**
- `config.js`: Runtime configuration (database connection, port)
- `.babelrc`: ES6+ transpilation rules
- `.eslintrc`: Code linting rules
- `jest.config.js`: Test runner configuration
- `webpack/webpack.common.js`: Shared Webpack settings

**Core Logic:**
- `src/redux/store.js`: Redux store initialization with DevTools
- `src/redux/reducers/reducer.js`: Root reducer combining all slices
- `server/routes/dataRoute.js`: All API endpoint definitions
- `server/controllers/api/data/dataController.js`: Data fetch implementations

**Testing:**
- `*.test.js` or `*.spec.js` files (located alongside source)
- Jest/Enzyme configuration in `jest.config.js` and `enzyme.config.js`

## Naming Conventions

**Files:**
- Components: PascalCase (`GlobeContainer.jsx`, `Conflict.jsx`)
- Utilities: camelCase (`api.js`, `dataProcessors.js`)
- Configuration: camelCase or kebab-case (`.eslintrc`, `package.json`)
- Routes: camelCase (`dataRoute.js`)

**Directories:**
- Feature areas: camelCase (`asylumApplication/`, `refug/`)
- Organizational: camelCase (`controllers/`, `defaultStates/`)

**Component Naming Pattern:**
- Containers (Redux-connected): Descriptive CamelCase (`GlobeContainer`, `AsyApplicationContainer`)
- Presentational: Descriptive CamelCase (`GlobeVisual`, `GlobeTimeline`)
- Specialized sub-components: ParentName_SubRole (`RefugeeRoute_map`, `RefugeeRoute_textArea`)

**Redux Files:**
- Actions: `[featureName]Actions.js` → exports action creators
- Reducers: `[featureName]Reducer.js` → exports reducer function
- Constants: `actionConstants.js` → exports action type constants
- Defaults: `[featureName]Defaults.js` → exports initial state

## Where to Add New Code

**New Feature:**
- Primary code: `src/components/[featureName]/` (create directory)
- Redux state: Add reducer to `src/redux/reducers/`, action to `src/redux/actions/`, constants to `actionConstants.js`
- Tests: Co-locate in `src/components/[featureName]/*.test.js`
- Routing: Register in `src/components/router/config/routeRegistry.jsx`

**New Component/Module:**
- Implementation: `src/components/[subdirectory]/[ComponentName].jsx`
- If container (Redux-connected): Suffix with `Container`
- If presentational: Use descriptive name
- Related utilities: `src/components/utils/`

**New API Endpoint:**
- Route definition: Add handler to `server/routes/dataRoute.js`
- Data logic: Add function to `server/controllers/api/data/dataController.js`
- Data processing: Add helpers to `server/controllers/api/data/helpers/`

**Utilities:**
- Shared helpers: `src/utils/[utilityName].js`
- Component utilities: `src/components/utils/[utilityName].js`
- Server utilities: `server/helpers/[utilityName].js`

**Styles:**
- Global styles: `src/styles/main.scss`
- Component styles: Inline with styled-components or `src/stylesheets/[component].scss`

## Special Directories

**`dist/`:**
- Purpose: Build output from Webpack
- Generated: Yes (run `npm run build`)
- Committed: No (in `.gitignore`)

**`node_modules/`:**
- Purpose: Installed npm dependencies
- Generated: Yes (run `npm install`)
- Committed: No (in `.gitignore`)

**`.planning/codebase/`:**
- Purpose: Codebase analysis documents
- Generated: Yes (via GSD map-codebase)
- Committed: Yes (for team reference)

**`server/database/`:**
- Purpose: Database layer - note that database connection is optional
- If MongoDB is configured: Stores schema definitions and connection logic
- If not configured: App runs in read-only mode using pre-loaded JSON files

## Build and Development Workflow

**Development Server:**
```bash
npm start                    # Starts webpack-dev-server on port 8080
                            # Proxies /data requests to localhost:2700
npm run nodemon            # Starts backend on port 2700 with file watching
```

**Production Build:**
```bash
npm run build              # Builds React app with webpack.prod.js
                          # Output in dist/
npm run kickoff           # Starts app with PM2 using ecosystem config
```

**File Serving:**
- React app: Built to `dist/` by Webpack, served as static files
- API: Express routes handle `/data/*` endpoints
- Fallback: All non-API requests serve `dist/index.html` (SPA routing)

---

*Structure analysis: 2026-03-10*
