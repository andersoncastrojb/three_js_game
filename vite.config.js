import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  root: '.',
  publicDir: 'assets',

  // ── Path aliases (Rule 4: use @/ instead of long relative paths) ──
  resolve: {
    alias: {
      '@':           fileURLToPath(new URL('./src', import.meta.url)),
      '@/core':      fileURLToPath(new URL('./src/core', import.meta.url)),
      '@/use-cases': fileURLToPath(new URL('./src/use-cases', import.meta.url)),
      '@/infra':     fileURLToPath(new URL('./src/infrastructure', import.meta.url)),
      '@/pres':      fileURLToPath(new URL('./src/presentation', import.meta.url)),
      // config/ lives at the project root, not inside src/ — use @config (no slash)
      '@config':     fileURLToPath(new URL('./config', import.meta.url)),
    },
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Separate Three.js into its own chunk (Vite 8/Rolldown: must be a function)
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
        },
      },
    },
  },

  server: {
    port: 5173,
    open: true,
  },
});
