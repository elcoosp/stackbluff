import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@stackbluff/shared': path.resolve(__dirname, '../../packages/shared'),
    },
  },
  server: { port: 5173 },
})
