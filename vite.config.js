import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { subsetFonts } from './scripts/subset-fonts.js'

export default defineConfig({
  base: '/', // blovy.art
  plugins: [
    vue(),
    {
      name: 'subset-fonts',
      async buildStart() {
        await subsetFonts()
      },
      async configureServer() {
        // dev 启动时也先生成子集到 src/assets/fonts/generated，供 CSS 相对路径引用
        await subsetFonts()
      },
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
