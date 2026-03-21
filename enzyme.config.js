/* eslint-disable import/no-extraneous-dependencies */

// Enzyme configuration — gracefully skip if enzyme is not installed.
// enzyme-adapter-react-16 requires React 16 and is incompatible with React 18.
// New tests use react-test-renderer directly; enzyme is kept here for any
// legacy enzyme-based tests that may be added later.
try {
  const { configure } = require('enzyme');
  const Adapter = require('enzyme-adapter-react-16');
  configure({ adapter: new Adapter() });
} catch (e) {
  // enzyme not installed — skip configuration
}
