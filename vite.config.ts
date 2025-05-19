import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext',
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['viem', 'permissionless']
        }
      }
    }
  },
  server: {
    port: 3000,
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
    include: ['viem', 'permissionless']
  },
  define: {
    global: 'globalThis',
    'process.env': {},
  },
  resolve: {
    alias: {
      process: 'process/browser',
      util: 'util',
    },
  },
}) 