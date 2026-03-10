# Coding Conventions

**Analysis Date:** 2026-03-10

## Naming Patterns

**Files:**
- React components: PascalCase with `.jsx` extension (e.g., `Conflict.jsx`, `RefugeeRoute.jsx`)
- Utility functions: camelCase with `.js` extension (e.g., `api.js`, `color-conversion-algorithms.js`)
- Reducers/Redux: camelCase with descriptive names (e.g., `conflictReducer.js`, `actionConstants.js`)
- Large component files use descriptive compound names (e.g., `RefugeeRoute_textArea_content_basicInfo.jsx`)

**Functions:**
- Arrow functions preferred for expression-based code: `const functionName = (param) => { }`
- Traditional function declarations used in some utilities: `function get_routeDeath() { }`
- Underscore_case used in some function names (legacy pattern): `get_routeDeath()`, `get_routeIBC()`
- camelCase standard for newer code and most functions

**Variables:**
- camelCase for local variables and parameters: `currentRouteName`, `selectedYear`, `loading`
- camelCase for component state properties: `clickedPointRemoved`, `banned_category`
- UPPER_SNAKE_CASE for constants: `SET_SELECTED_YEAR`, `SET_CURRENT_COUNTRY`
- `_dangle` used selectively (e.g., `window.__REDUX_DEVTOOLS_EXTENSION__`) with eslint disable comments

**Types:**
- Prop types used but not required for all components
- Redux state objects follow simple object patterns with clear property names
- No TypeScript/JSDoc type annotations in current codebase

## Code Style

**Formatting:**
- ESLint configured but no Prettier formatter
- Manual formatting with inconsistent spacing in some files
- Spacing around JSX attributes varies: `{value}`, `{ value }`, or `value = {value}`

**Linting:**
- Tool: ESLint 5.16.0 with Airbnb config
- Config file: `.eslintrc`
- Extended rules: `eslint-config-airbnb` with React and import plugins

**Key ESLint Rules:**
- `func-style: ["error", "expression"]` - Function expressions required
- `import/prefer-default-export: "off"` - Allow named exports
- `no-plusplus: "off"` - Allow `++` operators
- `object-curly-newline: "off"` - Flexible object brace formatting
- `no-console: ["error", { allow: ["warn", "error", "info"] }]` - Only allow console.warn/error/info (not log)
- `react/no-array-index-key: "off"` - Allow array index as React keys
- `react-hooks/rules-of-hooks: "error"` - Enforce hooks rules

## Import Organization

**Order:**
1. External packages (React, Redux, libraries): `import React from 'react'`
2. Local utilities: `import { get_routeDeath } from './../utils/api'`
3. Local components: `import RefugeeRoute_titleGroup from './RefugeeRoute_titleGroup'`
4. Styled components: `import styled from 'styled-components'`

**Path Aliases:**
- No path aliases configured
- Relative imports used throughout: `./`, `../`, `./../`
- Mixed import styles: `import * as _` and `import { functionName }`

**Export Patterns:**
- Named exports: `export { setSelectedYear, setCurrentCountry }`
- Default exports: `export default class Component extends React.Component`
- Module exports (CommonJS in server): `module.exports = { warNoteModel, asyApplicationModel }`

## Error Handling

**Patterns:**
- Promise-based with `.then()` chains for async operations
- No explicit error handling in most promises (callbacks ignore error parameters)
- Example from `src/utils/api.js`:
  ```javascript
  return new Promise((res) => {
    if(cached_routeDeath === null) {
      cached_routeDeath = fetch(request).then(res => res.json());
    }
    return res(cached_routeDeath);
  })
  ```
- Database operations wrap in promises without error callbacks: `warNoteModel.find({ id: query }, (err, data) => resolve(data))`
- No try/catch blocks observed in React components

## Logging

**Framework:** `console` object (no logging library)

**Allowed Methods:**
- `console.warn()` - For warnings
- `console.error()` - For errors
- `console.info()` - For informational messages (startup logs)
- `console.log()` - Not allowed by ESLint (violations exist but flagged)

**Patterns:**
- Server startup logs: `console.info(ENV_INFO)` in `server/server.js`
- Debug logs in components: `console.log('removed point manager called')` in `RefugeeRoute.jsx` line 74
- Console logs in third-party code (ignored): Three.js scripts contain console.log calls

## Comments

**When to Comment:**
- Rarely used; most code lacks comments
- Comments found mainly in algorithm explanations and legacy code
- Block comments used for third-party library code sections

**Documentation Pattern:**
- External sources documented with comments:
  ```javascript
  /**
   * rgbToHsl
   * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
   */
  ```
- No JSDoc/TSDoc used for function documentation
- No inline comments for code logic explanation

## Function Design

**Size:**
- Functions range from 5-50 lines in utilities
- Class methods in components often 10-30 lines
- Larger components exceed 300 lines (e.g., `RefugeeRoute_textArea_content_basicInfo.jsx` with 747 lines)

**Parameters:**
- Simple parameter lists with 0-3 parameters common
- Arrow functions with single params omit parentheses: `const setSelectedYear = selectedYearIndex => ({ ... })`
- Destructuring used in some components: `const { animate, AccordionsVisibility } = this.state`

**Return Values:**
- Redux actions return action objects: `{ type: constants.SET_SELECTED_YEAR, selectedYearIndex }`
- Promise-based functions return wrapped promises
- React components return JSX elements or null
- Utility functions return processed data or styled components

## Module Design

**Exports:**
- Redux modules use named exports for actions
- React components use default exports
- Server utilities use CommonJS module.exports
- Utility modules mix named and default exports

**Barrel Files:**
- Not used; direct file imports preferred
- Each component file imports what it needs explicitly

**Class Components:**
- Used throughout React codebase
- Standard React.Component inheritance: `export default class ComponentName extends React.Component`
- Constructor pattern with `this.bind()` for callbacks
- State property definition: `state = { property: value }` (newer) or constructor-based (older)
- Class field initialization: `this.banned_category = []` in constructors

---

*Convention analysis: 2026-03-10*
