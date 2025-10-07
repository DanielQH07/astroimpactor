import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  root: '.', // gốc là project
  publicDir: 'src', // thư mục chứa static assets
  base: './', // quan trọng khi deploy lên static hosting
  server: {
    host: true,
    open: '/src/index.html', // mở mặc định khi dev
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
        globe: resolve(__dirname, 'test/globe.html'),
        defense: resolve(__dirname, 'Defense/earth.html'),
      },
    },
  },
  resolve: {
    alias: {
      '/images': resolve(__dirname, 'src/images'),
      '/data': resolve(__dirname, 'src/data'), // map /data → src/data
    },
  },
})
