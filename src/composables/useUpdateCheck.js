// 检测线上是不是已经换了新版本：定时比对 version.json 里的 buildId 与本次构建的 __BUILD_ID__。
// 只提示不自动刷新

import { onBeforeUnmount, ref } from 'vue'

const FIRST_CHECK_MS = 30_000 // 别一进来就发请求，先把首屏让过去
const INTERVAL_MS = 60_000
const SILENCED_KEY = 'update.silenced' // 点了 later 之后本次会话不再提示

function silenced() {
  try {
    return sessionStorage.getItem(SILENCED_KEY) === '1'
  } catch {
    return false // 隐私模式下读不到，就照常检查
  }
}

// 通知弹出前先预加载 mesbin 贴图
const BIN_ART = ['/assets/mesbin.png', '/assets/mesbin_open.png']
const ART_TIMEOUT_MS = 1500 // 图拉不下来就算了

function preloadBinArt() {
  return Promise.race([
    Promise.all(
      BIN_ART.map(
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
      if (typeof buildId === 'string' && buildId && buildId !== __BUILD_ID__) {
        await preloadBinArt()
        available.value = true
        stop()
      }
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
    try {
      sessionStorage.setItem(SILENCED_KEY, '1')
    } catch {}
    available.value = false
    stop()
  }

  // 仅 prod 有 version.json，轮询
  // 本地可以用 npm run build && npm run preview 测试
  if (import.meta.env.PROD && !silenced()) {
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
