import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/permitscope/',
  server: { port: 5178, strictPort: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 1000 },
});
