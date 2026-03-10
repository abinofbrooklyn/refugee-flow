# Architecture

**Analysis Date:** 2026-03-10

## Pattern Overview

**Overall:** Full-stack MVC with client-side Redux state management and Express API backend

**Key Characteristics:**
- Client-side React application with Redux state container
- Express.js REST API backend serving data endpoints
- Separated build processes for client (Webpack) and server (Node.js)
- Component-driven UI architecture with feature-based organization
- Data-driven visualizations using D3.js and THREE.js

## Layers

**Presentation Layer:**
- Purpose: Render UI components and handle user interactions
- Location: `src/components/`
- Contains: React components (landing, conflict, refugee routes, about)
- Depends on: Redux store, API utilities, styling libraries
- Used by: Browser/React DOM

**State Management Layer:**
- Purpose: Centralized state container for application data
- Location: `src/redux/`
- Contains: Store configuration, reducers, actions, action constants, default states
- Depends on: Redux library
- Used by: Connected components via react-redux

**API/Data Fetching Layer:**
- Purpose: Handle HTTP requests and data retrieval from backend
- Location: `src/utils/api.js` and `src/components/utils/fetchers.js`
- Contains: Fetch wrappers, request builders, client-side caching
- Depends on: Fetch API, local JSON data
- Used by: Components and actions

**Backend API Layer:**
- Purpose: Serve data endpoints and handle database queries
- Location: `server/routes/` and `server/controllers/`
- Contains: Express route handlers, data controllers, database queries
- Depends on: Express.js, Mongoose, Node.js
- Used by: Client-side fetch requests

**Database Layer:**
- Purpose: Data persistence and query execution
- Location: `server/database/`
- Contains: Mongoose models, database connection, data processing
- Depends on: MongoDB (optional), Mongoose ODM
- Used by: Controllers

**Asset Layer:**
- Purpose: Static resources and configuration data
- Location: `src/assets/`, `src/data/`, `public/`
- Contains: Images, JSON data files, globe data, route dictionaries
- Depends on: File system
- Used by: Components and utilities

## Data Flow

**Conflict Module (War & Asylum Data):**

1. User loads `/conflict` route
2. `Conflict` component mounts and renders `GlobeContainer` + `AsyApplicationContainer`
3. `GlobeContainer` (Redux-connected) receives `selectedYear` and `currentCountry` from Redux state
4. `GlobeVisual` component requests war data via `fetchWarData()` API call
5. Backend `GET /data/reduced_war_data` returns processed war data from JSON
6. Data populates THREE.js globe visualization
7. User interacts with globe, triggering Redux actions `setSelectedYear`, `setCurrentCountry`
8. Reducers update Redux state
9. Connected components receive updated props and re-render

**Route Module (Refugee Migration Routes):**

1. User loads `/route/:arg` route (e.g., `/route/EasternMediterranean`)
2. `RefugeeRoute` component mounts and calls `fetchRefugeeRoutes()`
3. API calls: `get_routeDeath()` and `get_routeIBC()` → cached client-side
4. Backend endpoints return route death statistics and migration route data
5. Data passed to child components: `RefugeeRoute_map`, `RefugeeRoute_textArea`, `RefugeeRoute_titleGroup`
6. Mapbox/MapLibre renders interactive map with route data
7. User clicks map points, triggering state updates in component state (not Redux)
8. Text area content updates to show clicked point details

**Landing Page Module:**

1. User loads `/landing` route
2. `Router` component detects mobile vs desktop user agent
3. Renders `DesktopLanding` or `MobileLanding` accordingly
4. Components include animated intro and navigation to other sections

**State Management:**

Redux store contains:
- `conflictReducer`: Holds `selectedYear`, `currentCountry` for conflict visualization
- New reducers can be added to `combineReducers` in `src/redux/reducers/reducer.js`

Component-level state used for:
- Component lifecycle (loading states, UI toggles)
- Route-specific temporary state (clicked points, modal visibility)

## Key Abstractions

**Route Component Hierarchy:**

`RefugeeRoute` (container):
- Purpose: Manages refugee migration route visualization
- Examples: `src/components/RefugeeRoute.jsx`
- Pattern: Class component with local state, composed of smaller presentational components

`RefugeeRoute_map`:
- Purpose: Renders interactive map
- Examples: `src/components/RefugeeRoute_map.jsx`
- Pattern: MapLibre integration with data-driven styling

`RefugeeRoute_textArea`:
- Purpose: Shows details for selected map points
- Examples: `src/components/RefugeeRoute_textArea.jsx`
- Pattern: Content manager pattern using separate content components

**Conflict Module Hierarchy:**

`Conflict` (container):
- Purpose: Orchestrates globe visualization and asylum data
- Examples: `src/components/Conflict.jsx`
- Pattern: Class component managing loading state, composes GlobeContainer and AsyApplicationContainer

`GlobeContainer` (Redux-connected):
- Purpose: Redux-connected wrapper managing globe state
- Examples: `src/components/globe/GlobeContainer.jsx`
- Pattern: Class component with Redux connect, renders GlobeVisual

`GlobeVisual`:
- Purpose: Renders THREE.js globe
- Examples: `src/components/globe/GlobeVisual.jsx`
- Pattern: Class component with Canvas ref, THREE.js scene management

**Data Access Pattern:**

`dataController` functions:
- Purpose: Query database and return processed data
- Examples: `findReducedWar()`, `findWarNote()`, `findAsyApplicationAll()`
- Pattern: Return promises, used in route handlers

`dataProcessors`:
- Purpose: Transform raw data for API responses
- Examples: `warReducer`, `dataLoader`, `reduceGeoPercision`
- Pattern: Pure functions that filter, reduce, or normalize data

## Entry Points

**Client Entry:**
- Location: `src/index.jsx`
- Triggers: Browser load
- Responsibilities: Creates React root, wraps app with Redux Provider, renders Router component

**Server Entry:**
- Location: `server/server.js`
- Triggers: Node process start
- Responsibilities: Initializes Express app, mounts middleware (helmet, compression), registers routes, serves static React build, listens on port

**Route Handlers:**
- `/data/note/:id` → `findWarNote()`
- `/data/reduced_war_data` → `findReducedWar()`
- `/data/asy_application_all` → `findAsyApplicationAll()`
- `/data/route_death` → `findRouteDeath()`
- `/data/route_IBC_country_list` → `findRouteIbcCountryList()`
- `/data/route_IBC` → `findRouteIbc()`

## Error Handling

**Strategy:** Promise-based with catch blocks, returns error objects in responses

**Patterns:**

Backend route handlers:
```javascript
connection.then(() => {
  findData().then(d => res.json(d));
}).catch(err => res.json({ error: err }));
```

Client fetch wrappers:
```javascript
return new Promise((res) => {
  if(cached_data === null) {
    cached_data = fetch(request).then(res => res.json());
  }
  return res(cached_data);
})
```

Database connection:
```javascript
if (!database.connection) {
  console.warn('No database connection — running without DB');
  connection = Promise.resolve();
}
```

## Cross-Cutting Concerns

**Logging:** Console logging at initialization (environment info, database connection status)

**Security:** Helmet.js middleware for HTTP security headers, referrer policy enforcement

**Performance:** Compression middleware (gzip), client-side fetch caching, JSON data pre-loaded for assets

**Mobile Detection:** `mobile-detect` library used in route registry to render mobile vs desktop variants

---

*Architecture analysis: 2026-03-10*
