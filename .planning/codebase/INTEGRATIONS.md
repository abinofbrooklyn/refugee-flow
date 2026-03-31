# External Integrations

**Analysis Date:** 2026-03-10

## APIs & External Services

**Mapbox/MapLibre:**
- Service: MapLibre GL 2.4.0 and legacy Mapbox GL 0.45.0 for interactive maps
  - SDK: `maplibre-gl` and `mapbox-gl` npm packages
  - Auth: `mapboxToken` from `config.js`
  - Used in: Frontend components for refugee route visualization
  - Configuration: `config.js` stores `mapboxToken` (currently empty/disabled)

## Data Storage

**Databases:**
- MongoDB (optional)
  - Connection: `database.connection` from `config.js` (MongoDB connection string URI)
  - Client: Mongoose 5.5.11
  - Models defined in: `server/database/Models.js`
    - `war_all_note` - War conflict notes collection
    - `asy_application_all` - Asylum application statistics collection
  - Connection handled in: `server/database/connection.js`
  - Graceful degradation: Application runs without DB; notes feature disabled if connection string empty

**File Storage:**
- Local filesystem only
  - Static assets: `src/assets/` → copied to `dist/assets/` during build
  - Data files (JSON): Located in `src/data/` (referenced by frontend components)
    - `cot_latLng.json` - Latitude/longitude coordinates
    - `war_all.json` - War conflict data (loaded with geo precision reduction)
    - `asy_application_all.json` - Asylum application statistics
    - `route_death.json` - Death statistics on refugee routes
    - `country_route_list.json` - Country route information
    - `IBC_all.json` - IBC route data
    - `IBC_crossingCountByCountry.json` - Crossing count aggregates

**Caching:**
- Client-side caching (browser)
  - Fetch API with `cache: 'force-cache'` in `src/utils/api.js`
  - In-memory caching: `cached_routeDeath`, `cached_routeCountryList`, `cached_routeIBC` variables
- Redux state management: Application state stored in Redux store (`src/redux/store.js`)

## Authentication & Identity

**Auth Provider:**
- None - No external auth provider configured
- No API authentication required for current endpoints
- Notes feature requires database connection but no user authentication

## Monitoring & Observability

**Error Tracking:**
- Not integrated
- Manual error handling in Promise chains (e.g., `catch(err => res.json({ error: err }))` in routes)

**Logs:**
- Console logging approach:
  - Server startup: `console.info(ENV_INFO)` in `server/server.js`
  - Database events: `console.info('connected w/ db')`, `console.warn('err', err)` in `server/database/connection.js`
  - ESLint allows: `console.warn`, `console.error`, `console.info` (disallows bare `console.log`)
  - No structured logging framework integrated

**Redux DevTools:**
- Redux DevTools Extension integration in `src/redux/store.js` (development only)

## CI/CD & Deployment

**Hosting:**
- Self-hosted via PM2 process manager
- PM2 configuration: `pm2.ecosystem.json`
- Startup command: `npm run kickoff`

**CI Pipeline:**
- Not configured - No GitHub Actions, Jenkins, etc.

## Environment Configuration

**Required env vars:**
- `PORT` - Server port (default: 2700 for backend, 8080 for dev server)
- `NODE_ENV` - Environment mode (development/production)

**Optional env vars:**
- None explicitly defined - All configuration comes from `config.js`

**Secrets location:**
- `config.js` (Git-ignored, not committed)
  - Contains: `mapboxToken`, `database.connection`
- Configuration is sourced from `require('../../config.js')` in `server/database/connection.js`

## Webhooks & Callbacks

**Incoming:**
- None configured

**Outgoing:**
- None configured

## API Endpoints (Internal)

**Backend API Routes:**
All endpoints prefixed with `/data`, defined in `server/routes/dataRoute.js`:

- `GET /data/note/:id` - Fetch war note by ID (requires MongoDB)
  - Controller: `server/controllers/api/data/dataController.js`
  - Queries: `war_all_note` collection

- `GET /data/reduced_war_data` - Fetch war data with reduced geo precision
  - Returns processed war data from `war_all.json`
  - Processing: Geo coordinates reduced to 2 decimal places

- `GET /data/asy_application_all` - Fetch asylum application statistics
  - Returns: `asy_application_all.json` data

- `GET /data/route_death` - Fetch refugee route death statistics
  - Returns: `route_death.json` data
  - Caching: Client-side with force-cache policy

- `GET /data/route_IBC_country_list` - Fetch country list for IBC routes
  - Returns: `country_route_list.json` data
  - Caching: Client-side with force-cache policy

- `GET /data/route_IBC` - Fetch full IBC route data
  - Returns: `IBC_all.json` data
  - Caching: Client-side with force-cache policy

**Frontend API Integration:**
- Fetch API wrapper functions in `src/utils/api.js`:
  - `get_routeDeath()` - GET `/data/route_death`
  - `get_routeCountryList()` - GET `/data/route_IBC_country_list`
  - `get_routeIBC()` - GET `/data/route_IBC`
  - `get_routeCrossingCount()` - Returns local JSON (no API call)

- Webpack dev server proxy: `/data` routes proxied to `http://localhost:2700` (configured in `webpack/webpack.dev.js`)

## Data Flow

1. **Frontend requests data** via Fetch API in `src/utils/api.js`
2. **Express server** receives request at `/data/*` endpoint
3. **Controller** (`dataController.js`) processes request:
   - Loads JSON data files from disk or
   - Queries MongoDB if configured
4. **Response** sent as JSON back to frontend
5. **Client caching** prevents repeat requests for same endpoints

## Security Configuration

- Helmet.js middleware enables HTTP security headers
  - Custom referrer policy: `no-referrer`
- Gzip compression enabled via compression middleware
- Static file serving: Only files in `dist/` served
- SPA routing: All non-matching routes serve `index.html` for React Router

---

*Integration audit: 2026-03-10*
