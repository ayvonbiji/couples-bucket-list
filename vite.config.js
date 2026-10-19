import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Heavy, rarely used libraries get their own chunks so first load stays fast.
        manualChunks: {
          export: ['jspdf', 'jszip'],
          map: ['leaflet', 'react-leaflet'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
});
