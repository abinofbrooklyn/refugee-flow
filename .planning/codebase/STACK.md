# Technology Stack

**Analysis Date:** 2026-03-10

## Languages

**Primary:**
- JavaScript ES6+ - Used throughout frontend and backend
- JSX - React component syntax used in `src/` (`.jsx` files)

## Runtime

**Environment:**
- Node.js v22.20.0

**Package Manager:**
- npm 10.9.3
- Lockfile: `package-lock.json` (v3, present)

## Frameworks

**Frontend:**
- React 16.8.6 - UI library
- Redux 4.0.1 - State management
- React-Redux 7.0.3 - React-Redux bindings
- React-Router-DOM 4.2.2 - Client-side routing

**Backend:**
- Express 4.17.0 - HTTP server framework
- Mongoose 5.5.11 - MongoDB object modeling

**Visualization & Graphics:**
- D3.js 5.9.2 - Data visualization
- Three.js 0.91.0 - 3D graphics library
- MapLibre GL 2.4.0 - Vector maps (modern Mapbox alternative)
- Mapbox GL 0.45.0 - Legacy Mapbox library (deprecated)
- D3 Canvas Transition 0.3.7 - D3 canvas animation utilities

**UI Components & Styling:**
- Styled Components 3.4.10 - CSS-in-JS styling
- React Modal 3.8.1 - Modal dialog component
- React Spinners 0.3.2 - Loading spinner components
- Fuse.js 3.4.4 - Fuzzy search library

**Utilities:**
- Lodash 4.17.11 - Utility library
- Underscore 1.9.1 - Utility library (legacy)
- jQuery 3.4.1 - DOM manipulation (legacy)
- Moment 2.24.0 - Date/time handling
- Countup.js 1.9.3 - Number animation library
- Mobile Detect 1.4.3 - Device detection
- Mousetrap 1.6.3 - Keyboard shortcut library
- Scroll.js 1.8.8 - Scroll utility library

**Testing:**
- Jest 24.8.0 - Test runner
- Babel Jest 24.8.0 - Babel transformer for Jest

**Build & Dev Tools:**
- Webpack 4.32.2 - Module bundler
  - Webpack Dev Server 3.4.1 - Development server
  - Webpack CLI 3.3.2 - CLI interface
  - Webpack Merge 4.2.1 - Config merging utility
  - Webpack Bundle Analyzer 3.3.2 - Bundle analysis
- Babel 7.4.5+ - JavaScript transpiler
  - `@babel/core` 7.4.5
  - `@babel/preset-env` 7.4.5 - ES6+ transpilation
  - `@babel/preset-react` 7.0.0 - JSX transpilation
  - `@babel/plugin-proposal-class-properties` 7.4.4 - Class property syntax
  - babel-eslint 10.0.1 - Babel parser for ESLint
- ESLint 5.16.0 - Code linting
  - eslint-config-airbnb 17.1.0 - Airbnb style rules
  - eslint-plugin-import 2.17.3 - Import statement linting
  - eslint-plugin-jsx-a11y 6.2.1 - JSX accessibility linting
  - eslint-plugin-react 7.13.0 - React-specific linting
  - eslint-plugin-react-hooks 1.6.0 - Hooks linting
- SASS 1.77.0 - CSS preprocessor
  - SASS Loader 10.5.2 - Webpack SASS loader
- Style Loader 0.23.1 - CSS injection into DOM
- CSS Loader 2.1.1 - CSS module loader
- File Loader 3.0.1 - File asset loader
- URL Loader 1.1.2 - URL-based asset loader
- Mini CSS Extract Plugin 0.6.0 - CSS extraction plugin
- Optimize CSS Assets Plugin 5.0.1 - CSS minification
- Clean Webpack Plugin 2.0.2 - Output directory cleanup
- Copy Webpack Plugin 5.0.3 - Static file copying
- React SVG Loader 3.0.3 - SVG as React component
- HTML Webpack Plugin 3.2.0 - HTML generation

**Security & Middleware:**
- Helmet 3.18.0 - Express security headers middleware
- Compression 1.7.4 - Express gzip middleware

**API/Request Handling:**
- Fetch API (built-in) - HTTP requests (used in `src/utils/api.js`)
- Custom Promise-based wrappers for API calls

**Utilities:**
- Prop Types 15.7.2 - React prop validation

## Configuration

**Environment:**
- `config.js` - Application configuration (not committed)
- `config.example.js` - Configuration template
- Configuration values:
  - `mapboxToken` - Mapbox API credentials
  - `database.connection` - MongoDB connection string

**Build:**
- `webpack/webpack.common.js` - Common Webpack configuration
- `webpack/webpack.dev.js` - Development server config with HMR, CSS-in-JS, proxy to backend at `http://localhost:2700`
- `webpack/webpack.prod.js` - Production optimization with CSS extraction, code splitting, bundle analysis

**Babel:**
- `.babelrc` - Babel transpilation configuration targeting last 2 browser versions

**Linting:**
- `.eslintrc` - ESLint configuration extending Airbnb preset with custom rules for function expressions, no console logs (except warn/error/info), React hooks

**Testing:**
- `jest.config.js` - Jest configuration with asset mocking
- `enzyme.config.js` - Enzyme test setup file (referenced in Jest config)

**Package Management:**
- `package.json` - Main dependency manifest
- `package-lock.json` - Locked dependency versions (npm v3)

**Deployment:**
- `pm2.ecosystem.json` - PM2 process manager configuration for production deployment
  - Entry point: `server/server.js`
  - Port: 2700
  - Watch mode enabled for auto-reload
  - Production environment variables: `NODE_ENV=production`, `PORT=2700`

## Platform Requirements

**Development:**
- Node.js v22.20.0 (note: uses legacy OpenSSL provider flag in scripts: `NODE_OPTIONS=--openssl-legacy-provider`)
- npm 10.x
- MongoDB (optional - notes feature disabled if not configured)

**Production:**
- Node.js v22.20.0
- PM2 for process management
- MongoDB (optional - notes feature disabled if not configured)
- Environment: Linux/Unix

## Runtime Scripts

```bash
npm start                # Development: Webpack dev server on port 8080 with HMR
npm run build           # Production: Webpack bundle to dist/
npm run nodemon         # Backend development: Node file watching on port 2700
npm run kickoff         # Production: Start with PM2 from ecosystem config
npm run lint            # ESLint check (JS and JSX)
npm test                # Jest test runner
```

---

*Stack analysis: 2026-03-10*
