import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import TanStackRouterPlugin from '@tanstack/router-plugin/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    TanStackRouterPlugin({ target: 'react', autoCodeSplitting: true }),
    react(), // This handles JSX transform and React runtime automatically
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@stackbluff/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
  optimizeDeps: {
    // Include React in pre-bundling to avoid resolution issues
    include: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  build: {
    // No external – we want React to be bundled (or resolved via plugin)
    // Rolldown will use the plugin's transformation.
    commonjsOptions: {
      include: [/node_modules/],
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') },
    },
  },
})
