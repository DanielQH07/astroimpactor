import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  root: '.', // gốc là project
  publicDir: 'src',
  base: './',
  server: {
    host: true,
    open: '/src/index.html' // mở mặc định src/index.html khi dev
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
        globe: resolve(__dirname, 'test/globe.html'),
        defense: resolve(__dirname, 'Defense/earth.html')
      }
    }
  },
  // ⚡️ Thêm phần này
  resolve: {
    alias: {
      '/images': resolve(__dirname, 'src/images'),
    '/data': resolve(__dirname, 'src/data'), // ✅ map /data → src/data

    }
  }
})