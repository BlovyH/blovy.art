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
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
