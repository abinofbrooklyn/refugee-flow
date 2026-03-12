import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

export default defineConfig({
  plugins: [
    react(),
    svgr({
      include: '**/*.svg',
      svgrOptions: { exportType: 'default' },
    }),
  ],
  publicDir: 'src/assets',
  resolve: {
    alias: {
      // d3-canvas-transition has a broken "module" field pointing to a non-existent path;
      // pin Vite directly to the CJS build.
      'd3-canvas-transition': new URL(
        './node_modules/d3-canvas-transition/build/d3-canvas-transition.js',
        import.meta.url,
      ).pathname,
    },
  },
  server: {
    port: 8080,
    open: true,
    proxy: {
      '/data': 'http://localhost:2700',
    },
  },
  build: {
    outDir: 'dist',
  },
});
