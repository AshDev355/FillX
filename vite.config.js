import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: '.',
  base: './',   // ← relative paths so Chrome extension works
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: { popup: path.resolve(__dirname, 'src/popup/main.jsx') },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name]-[hash].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  optimizeDeps: {
    include: ['jszip'],
    exclude: ['mammoth', 'pdfjs-dist'],
  },
});
