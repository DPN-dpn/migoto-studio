import { defineConfig } from 'vite';

// Tauri expects a fixed dev port.
export default defineConfig({
  base: './',
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: '127.0.0.1',
    watch: { ignored: ['**/.toolchain/**', '**/src-tauri/**', '**/data/**'] },
  },
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
});
