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
  define: {
    // 报错带版本号
    // 用时间戳而不是 git rev：构建机不一定有 git，也不想在构建里跑外部命令
    __BUILD_AT__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    // 'hidden' = 照常产出 .map 但不在 js 里写 sourceMappingURL，否则实际请求会报 404
    sourcemap: 'hidden',
    rollupOptions: { output: { sourcemapExcludeSources: true } },
  },
})
