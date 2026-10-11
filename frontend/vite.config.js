import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://127.0.0.1:3000',
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            if (err.code !== 'ECONNABORTED' && err.code !== 'ECONNRESET') {
              console.warn('WebSocket proxy error:', err.message);
            }
          });
        },
      },
    },
  },
})
