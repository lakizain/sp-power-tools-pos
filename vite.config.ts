import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
          supabase: [
            '@supabase/supabase-js',
            '@supabase/auth-helpers-nextjs',
            '@supabase/auth-helpers-react',
            '@supabase/auth-ui-react',
            '@supabase/auth-ui-shared',
          ],
          data: ['xlsx', 'date-fns'],
          charts: ['recharts'],
          icons: ['lucide-react'],
          alerts: ['sweetalert2'],
        },
      },
    },
  },
});
