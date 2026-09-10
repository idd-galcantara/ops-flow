import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Dev server proxies /api to the backend so the browser talks to a single origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
