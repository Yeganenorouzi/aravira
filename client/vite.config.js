import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = __dirname;
const projectRoot = path.join(__dirname, '..');

export default defineConfig({
  root,
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.join(root, 'src'),
      '@shared': path.join(projectRoot, 'shared'),
    },
  },
  server: {
    port: 5173,
    open: true,
    fs: { allow: [projectRoot] },
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  build: {
    outDir: path.join(root, 'dist'),
    emptyOutDir: true,
  },
});
