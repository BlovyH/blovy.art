import { fileURLToPath, URL } from 'node:url'
import { createRequire } from 'node:module'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { subsetFonts } from './scripts/subset-fonts.js'

// 弹幕调参面板的「保存」接口：实现放在 gitignored 的文件里，不在就当没这个功能
const requireLocal = createRequire(import.meta.url)
let stgTuner = null
try {
  stgTuner = requireLocal('./.workbuddy/stg-tuner-server.cjs')
} catch {
  stgTuner = null
}

export default defineConfig({
  base: '/', // blovy.art
  plugins: [
    vue(),
    ...(stgTuner ? [stgTuner()] : []),
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
