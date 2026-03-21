/**
 * SVG mock for Jest — SVG imports in source files use @svgr/webpack (or vite-plugin-svgr)
 * which converts SVGs to React components. In Jest (jsdom) we mock them as simple
 * functional components that render a <svg> placeholder with the given props.
 */
const React = require('react');

const SvgMock = (props) => React.createElement('svg', { 'data-testid': 'svg-mock', ...props });

module.exports = SvgMock;
module.exports.default = SvgMock;
module.exports.ReactComponent = SvgMock;
