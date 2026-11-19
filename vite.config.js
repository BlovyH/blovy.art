import { fileURLToPath, URL } from 'node:url'
import { createRequire } from 'node:module'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import * as compilerSfc from 'vue/compiler-sfc'
import { subsetFonts } from './scripts/subset-fonts.js'
import { i18nCheck } from './scripts/i18n-check.js'

const requireLocal = createRequire(import.meta.url)

// 需要在生产包里内联成 base64 的 sprite，源码照常写 /assets/xxx.png
const inlineSmallSprites = requireLocal('./scripts/inline-small-sprites.cjs')
const INLINE_SPRITES = [
  'basement_entrance.png',
  'btn_undo.png',
  'deskicon_frame.png',
  'dialog_common.png',
  'dialog_common_arrow.png',
  'dialog_deghost.png',
  'dialog_deghost_arrow.png',
  'door.png',
  'emotion_drop.png',
  'emotion_face.png',
  'emotion_face_sad.png',
  'eye-protection.png',
  'flower_cake.png',
  'flower_piece.png',
  'i18n_tips.png',
  'iy_icon-Sheet.png',
  'kajiu_logo.png',
  'mesbin.png',
  'mesbin_open.png',
  'nothing.png',
  'pin.png',
  'run_away.png',
  'screensaver.png',
  'signal_receiver-Sheet.png',
  'sign.png',
  'ski.png',
  'ski_on.png',
  'sl_icon_bili.png',
  'sl_icon_bs.png',
  'sl_icon_kofi.png',
  'sl_icon_p.png',
  'sl_icon_rb.png',
  'sl_icon_wx.png',
  'something.png',
  'sunglasses.png',
  'sunglasses_glow.png',
  'sunglasses_off.png',
  'sunglasses_on.png',
  'torch.png',
  'unused_emotion_face_lunatic.png',
  'wiki_lock.png',
  'window_btn_c.png',
  'window_btn_max.png',
  'window_btn_min.png',
  'window_btn_restore.png',
  'window_frame.png',
  'window_frame_sub.png',
  'window_frame_thick.png',
]

// 弹幕调参面板的「保存」接口：实现放在 gitignored 的文件里，不在就当没这个功能
let stgTuner = null
try {
  stgTuner = requireLocal('./.workbuddy/stg-tuner-server.cjs')
} catch {
  stgTuner = null
}

// 新版本检测的身份标识。GitHub Actions 自带 GITHUB_SHA，用它当版本来源：
// 同一个 commit 重跑 workflow 不会误报一次。本地构建没有这个变量，退回时间戳。
const BUILD_ID = process.env.GITHUB_SHA || new Date().toISOString()

export default defineConfig({
  base: '/', // blovy.art
  plugins: [
    // compiler 默认要等 buildStart 才解析，dev 的 HMR 可能更早到
    vue({ compiler: compilerSfc }),
    inlineSmallSprites({ sprites: INLINE_SPRITES }),
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
    {
      // 构建时校验 i18n 词条配置完整性，dev 不查
      name: 'i18n-check',
      apply: 'build',
      async buildStart() {
        await i18nCheck(fileURLToPath(new URL('./', import.meta.url)))
      },
    },
    {
      // 供前端轮询比对的当前版本。不进 git，每次构建现产
      name: 'build-version',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({ buildId: BUILD_ID }),
        })
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
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  build: {
    // 'hidden' = 照常产出 .map 但不在 js 里写 sourceMappingURL，否则实际请求会报 404
    sourcemap: 'hidden',
    rollupOptions: { output: { sourcemapExcludeSources: true } },
  },
})
