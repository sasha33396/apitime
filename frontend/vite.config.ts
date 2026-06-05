import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Во время локальной разработки (npm run dev) запросы /api проксируются на бэкенд.
// В продакшене статику отдаёт Caddy, а /api он же проксирует на контейнер backend.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
