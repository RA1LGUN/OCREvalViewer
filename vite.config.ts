import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// pdfs/ 与 doc_exports/ 现位于 public/ 下，Vite 会自动作为静态资源服务，
// 无需自定义 middleware。生产构建时也会一并被拷贝到 dist/。
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
