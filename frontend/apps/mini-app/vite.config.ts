import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const isTelegram = mode === 'telegram';
  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_TELEGRAM': JSON.stringify(isTelegram),
    },
    server: {
      port: 5174,
    },
  };
});
