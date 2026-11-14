// 检测线上是不是已经换了新版本：定时比对 version.json 里的 buildId 与本次构建的 __BUILD_ID__。
// 只提示不自动刷新

import { onBeforeUnmount, ref } from 'vue'
import { MESBIN_ART } from '@/components/MesBin.vue'

const FIRST_CHECK_MS = 30_000 // 别一进来就发请求，先把首屏让过去
const INTERVAL_MS = 60_000

// 关掉通知只忽略这一个 buildId，线上再换版本就重新弹
let dismissedBuildId = null
let currentBuildId = null

// 通知弹出前先预加载 mesbin 贴图
const ART_TIMEOUT_MS = 1500 // 图拉不下来就算了

function preloadBinArt() {
  return Promise.race([
    Promise.all(
      MESBIN_ART.map(
        (src) =>
          new Promise((done) => {
            const img = new Image()
            img.onload = img.onerror = done
            img.src = src
          })
      )
    ),
    new Promise((done) => setTimeout(done, ART_TIMEOUT_MS)),
  ])
}

export function useUpdateCheck() {
  const available = ref(false)
  let interval = null
  let firstTimer = null

  function stop() {
    clearInterval(interval)
    clearTimeout(firstTimer)
    interval = null
    firstTimer = null
  }

  async function check() {
    try {
      // 时间戳参数绕开 GitHub Pages 给静态资源套的 CDN 缓存（自带 max-age=600）
      const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, {
        cache: 'no-store',
      })
      if (!res.ok) return
      const { buildId } = await res.json()
      if (typeof buildId !== 'string' || !buildId) return
      if (buildId === __BUILD_ID__ || buildId === dismissedBuildId || buildId === currentBuildId) return
      currentBuildId = buildId
      await preloadBinArt()
      available.value = true
    } catch {
      // 拿不到版本就算了
    }
  }

  function start() {
    stop()
    interval = setInterval(check, INTERVAL_MS)
  }

  // 切走时不白跑请求，切回来立刻查一次
  function onVisibility() {
    if (document.visibilityState === 'visible') {
      check()
      start()
    } else {
      stop()
    }
  }

  function dismiss() {
    dismissedBuildId = currentBuildId
    available.value = false
  }

  // 仅 prod 有 version.json，轮询
  // 本地可以用 npm run build && npm run preview 测试
  if (import.meta.env.PROD) {
    firstTimer = setTimeout(() => {
      check()
      start()
    }, FIRST_CHECK_MS)
    document.addEventListener('visibilitychange', onVisibility)
  }

  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisibility)
    stop()
  })

  return { available, dismiss }
}
