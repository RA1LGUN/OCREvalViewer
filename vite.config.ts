import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

// 把项目根目录下的 pdfs/ 与 doc_exports/ 当作静态资源服务
// /pdfs/<name>.pdf 会在 pdfs/ 及其一级子目录中查找（支持 chinese / english 等子目录）
function localStatic() {
  const pdfRoot = path.resolve(__dirname, 'pdfs');
  const docExportRoot = path.resolve(__dirname, 'doc_exports');

  function findPdf(name: string): string | null {
    // 先看 /pdfs/<name>，再看 /pdfs/<sub>/<name>
    const direct = path.join(pdfRoot, name);
    if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;
    if (!fs.existsSync(pdfRoot)) return null;
    for (const sub of fs.readdirSync(pdfRoot)) {
      const candidate = path.join(pdfRoot, sub, name);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    }
    return null;
  }

  function send(res: any, filePath: string) {
    const ext = path.extname(filePath).toLowerCase();
    const mime: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.json': 'application/json; charset=utf-8',
      '.md': 'text/markdown; charset=utf-8',
    };
    res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache');
    fs.createReadStream(filePath).pipe(res);
  }

  return {
    name: 'serve-local-data',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const url = decodeURIComponent((req.url || '').split('?')[0]);

        if (url.startsWith('/pdfs/')) {
          const rel = url.slice('/pdfs/'.length);
          // 支持显式子路径 chinese/foo.pdf，也支持仅文件名
          const direct = path.join(pdfRoot, rel);
          if (fs.existsSync(direct) && fs.statSync(direct).isFile()) {
            return send(res, direct);
          }
          if (!rel.includes('/')) {
            const found = findPdf(rel);
            if (found) return send(res, found);
          }
        } else if (url.startsWith('/doc_exports/')) {
          const rel = url.slice('/doc_exports/'.length);
          const filePath = path.join(docExportRoot, rel);
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            return send(res, filePath);
          }
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localStatic()],
  server: {
    port: 5173,
    fs: { allow: ['..'] },
  },
});
