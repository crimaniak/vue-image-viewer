import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ command }) => ({
  plugins: [vue()],
  // The demo's sample images must not end up in the library build.
  publicDir: command === 'build' ? false : 'demo/public',
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'VueImageViewer',
      fileName: 'vue-image-viewer',
      cssFileName: 'style',
    },
    rollupOptions: {
      external: ['vue'],
      output: { globals: { vue: 'Vue' }, exports: 'named' },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
}))
