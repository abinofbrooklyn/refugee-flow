/**
 * Type declarations for SVG imports via vite-plugin-svgr.
 * vite.config.ts uses exportType: 'default' so SVGs are React components.
 */
declare module '*.svg' {
  import * as React from 'react';
  const ReactComponent: React.FunctionComponent<
    React.ComponentProps<'svg'> & { title?: string }
  >;
  export default ReactComponent;
}
