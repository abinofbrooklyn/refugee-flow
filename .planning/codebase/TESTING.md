# Testing Patterns

**Analysis Date:** 2026-03-10

## Test Framework

**Runner:**
- Jest 24.8.0
- Config: `jest.config.js`

**Assertion Library:**
- Built-in Jest assertions (expect API)

**Testing Library:**
- Enzyme 3.x (configured via `enzyme.config.js`)
- Adapter: `enzyme-adapter-react-16` for React 16.8.6

**Run Commands:**
```bash
npm test              # Run all tests (configured in package.json)
```

## Test File Organization

**Location:**
- No test files found in `src/` directory
- Testing infrastructure configured but no tests currently implemented

**Naming:**
- Expected pattern: `*.test.js`, `*.test.jsx`, `*.spec.js`, `*.spec.jsx`
- Convention from ESLint config indicates Jest environment configured

**Structure:**
```
src/
├── components/
├── redux/
├── utils/
└── (test files would be co-located or in __tests__ directories)
```

## Test Setup Configuration

**Jest Config:**
`jest.config.js` contents:
```javascript
module.exports = {
  moduleNameMapper: { '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga|css|scss)$': 'babel-jest' },
  setupFilesAfterEnv: ['<rootDir>/enzyme.config.js'],
};
```

**Enzyme Setup:**
`enzyme.config.js` configures React 16 adapter:
```javascript
import { configure } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';

configure({ adapter: new Adapter() });
```

## Mocking

**Framework:**
- Jest built-in mocking capabilities
- Manual mocking would follow Jest conventions

**File Mocking Pattern:**
- Style/asset imports mapped to `babel-jest` in moduleNameMapper:
  - Images: `.jpg`, `.jpeg`, `.png`, `.gif`
  - Fonts: `.eot`, `.otf`, `.woff`, `.woff2`, `.ttf`
  - Media: `.mp4`, `.webm`, `.wav`, `.mp3`, `.m4a`, `.aac`, `.oga`
  - Styles: `.css`, `.scss`

**What to Mock:**
- External APIs (fetch calls in `src/utils/api.js`)
- Component dependencies (child components)
- Third-party libraries (mapbox-gl, d3, three.js)
- Static assets (images, fonts, stylesheets)

**What NOT to Mock:**
- Utility functions (color-conversion-algorithms.js)
- Redux reducers and action creators
- React lifecycle methods (test through component behavior)

## Fixtures and Factories

**Test Data:**
- No fixtures or factories currently implemented
- Data files exist in `src/data/` but are used at runtime, not for tests
- JSON data files available in `server/controllers/api/data/datasets/`

**Location (when implemented):**
- Recommend: `src/__tests__/fixtures/` or `src/__mocks__/`
- Or co-locate with test files: `Component.test.js` adjacent to `Component.jsx`

## Coverage

**Requirements:**
- No coverage enforcement configured
- No coverage threshold set in jest.config.js

**View Coverage (when tests are written):**
```bash
npm test -- --coverage
```

## Test Types

**Unit Tests (planned):**
- Scope: Individual functions and components
- Approach: Test pure functions, reducers, and component rendering
- Example targets:
  - Redux reducers: `src/redux/reducers/conflictReducer.js`
  - Utility functions: `src/utils/color-conversion-algorithms.js`, `src/utils/api.js`
  - Simple components: Presentational React components

**Integration Tests (planned):**
- Scope: Component interactions and data flow
- Approach: Test components with Redux store, child components
- Example targets:
  - `src/components/RefugeeRoute.jsx` with API calls
  - `src/components/Conflict.jsx` with multiple sub-components
  - Redux-connected components

**E2E Tests:**
- Framework: Not currently configured
- No Cypress, Playwright, or Selenium setup

## Common Patterns (to implement)

**Basic Jest/Enzyme Component Test Structure (recommended):**
```javascript
import React from 'react';
import { shallow, mount } from 'enzyme';
import ComponentName from '../ComponentName';

describe('ComponentName', () => {
  it('should render without crashing', () => {
    const wrapper = shallow(<ComponentName />);
    expect(wrapper.exists()).toBe(true);
  });

  it('should update state on prop change', () => {
    const wrapper = shallow(<ComponentName prop="initial" />);
    wrapper.setProps({ prop: 'updated' });
    expect(wrapper.state('someState')).toEqual('expected');
  });
});
```

**Redux Reducer Test Structure (recommended):**
```javascript
import conflictReducer from '../conflictReducer';
import constants from '../../actionConstants';

describe('conflictReducer', () => {
  it('should return initial state', () => {
    expect(conflictReducer(undefined, {})).toEqual({
      selectedYear: 0,
      currentCountry: 'GLOBAL'
    });
  });

  it('should handle SET_SELECTED_YEAR', () => {
    const action = { type: constants.SET_SELECTED_YEAR, selectedYearIndex: 5 };
    const result = conflictReducer(undefined, action);
    expect(result.selectedYear).toBe(5);
  });
});
```

**Async Testing (for API calls):**
```javascript
it('should fetch data and update state', () => {
  // Mock fetch
  global.fetch = jest.fn(() =>
    Promise.resolve({
      json: () => Promise.resolve({ data: 'mock' })
    })
  );

  const wrapper = shallow(<ComponentWithAsync />);
  return wrapper.instance().fetchData().then(() => {
    expect(wrapper.state('data')).toEqual({ data: 'mock' });
  });
});
```

**Error Testing:**
```javascript
it('should handle promise rejection', () => {
  global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));

  const wrapper = shallow(<ComponentWithAsync />);
  return wrapper.instance().fetchData().catch(err => {
    expect(err.message).toBe('Network error');
  });
});
```

## ESLint Configuration for Tests

**Test Environment:**
- Jest environment enabled in `.eslintrc`: `"jest": true`
- Allows `describe`, `it`, `expect`, `beforeEach`, etc. without importing

## Current Testing Status

**Implemented Tests:**
- None found in codebase

**Missing Test Coverage:**
- Redux actions and reducers: `src/redux/`
- Utility functions: `src/utils/api.js`, `src/utils/color-conversion-algorithms.js`
- React components: All components in `src/components/`
- Server controllers: `server/controllers/api/data/dataController.js`

**Recommendations:**
1. Start with utility function tests (highest value, simplest)
2. Add Redux reducer tests (pure functions, easy to test)
3. Implement component tests with Enzyme (requires mocking child components and APIs)
4. Add integration tests for full feature flows

---

*Testing analysis: 2026-03-10*
