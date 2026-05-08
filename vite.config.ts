import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// pdfs/ and doc_exports/ are now under public/, Vite serves them as static assets
// automatically — no custom middleware needed. They are also copied to dist/ on production builds.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
