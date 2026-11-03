import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// base './'：相對路徑，部署到 GitHub Pages 子路徑 (/repo-name/) 也能正常載入；路由使用 hash，不需伺服器改寫。
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: false },
  preview: { port: 4173 },
});
