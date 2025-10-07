import { defineConfig } from 'vite'
import { resolve } from 'path'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  root: '.', // gốc là project
  publicDir: "src/", // ❌ Không cần static/
  base: './', // dùng đường dẫn tương đối để chạy cả local + vercel
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
  plugins: [
    viteStaticCopy({
      targets: [
        // ✅ Copy toàn bộ thư mục Defense (ảnh + glb) sang dist/Defense
        { src: 'Defense/**/*', dest: 'Defense' },
        // ✅ Copy ảnh từ src/images sang dist/src/images
        { src: 'src/images/**/*', dest: 'src/images' },
        // ✅ Copy data JSON (nếu bạn dùng)
        { src: 'src/data/**/*', dest: 'src/data' },
      ],
    }),
  ],
  resolve: {
    alias: {
      '/images': resolve(__dirname, 'src/images'),
      '/data': resolve(__dirname, 'src/data'),
      '/Defense': resolve(__dirname, 'Defense'),
    },
  },
  assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.hdr', '**/*.png', '**/*.jpg'],
})