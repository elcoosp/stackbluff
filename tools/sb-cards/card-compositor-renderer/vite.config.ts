import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    open: true,
    fs: {
      // Allow serving files from these directories
      allow: [
        '=== Undoing symlinks and fixing asset serving ===
Removing symlinks from public//1-raw/art',
        '=== Undoing symlinks and fixing asset serving ===
Removing symlinks from public//2-pips',
        '=== Undoing symlinks and fixing asset serving ===
Removing symlinks from public/
/Users/adm/Documents/Repos/stackbluff/tools/sb-cards/card-compositor-renderer/public/fonts',
        '.',
      ]
    }
  },
  resolve: {
    alias: {
      '@': '/src',
    }
  }
});
