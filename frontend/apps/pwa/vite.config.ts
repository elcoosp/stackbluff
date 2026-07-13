import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: true,
      devOptions: {
        enabled: true,
        type: 'module'
      },
      manifest: {
        name: 'StackBluff',
        short_name: 'StackBluff',
        description: 'StackBluff Poker App',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    }),
    react(),
    tailwindcss(), // ✅ now included
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@stackbluff/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''), // 👈 this removes '/api'
      },
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});

import { sentryVitePlugin } from '@sentry/vite-plugin';

// Add to plugins array (after react())
// plugins: [
//   react(),
//   sentryVitePlugin({
//     org: process.env.SENTRY_ORG,
//     project: process.env.SENTRY_PROJECT,
//     authToken: process.env.SENTRY_AUTH_TOKEN,
//   }),
// ],
//
// build: {
//   sourcemap: true,
// },
