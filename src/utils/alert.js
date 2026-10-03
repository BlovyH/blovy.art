// 访客侧的脚本错误上报，归档到 R2

const SEEN_KEY = 'logalert.seen'
const SEEN_MAX = 50
const MAX_MSG = 500
const MAX_STACK = 2000

function endpoint() {
  const url = import.meta.env.VITE_ALERT_URL
  return typeof url === 'string' ? url.trim() : ''
}

function ownOrigin(src) {
  if (!src) return false
  try {
    return new URL(src, location.href).origin === location.origin
  } catch {
    return false
  }
}

// 同一个错在一个会话里只发一次：循环里报错一秒能来几百条，会把归档端点的限流打满
function firstTime(key) {
  try {
    const seen = JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? '[]')
    if (seen.includes(key)) return false
    seen.push(key)
    sessionStorage.setItem(SEEN_KEY, JSON.stringify(seen.slice(-SEEN_MAX)))
    return true
  } catch {
    // 隐私模式下 sessionStorage 会抛，拿不到去重记录就干脆不发，别每次都发
    return false
  }
}

function send(msg, stack) {
  const url = endpoint()
  if (!url) return
  const key = `${msg}|${String(stack ?? '').split('\n')[0]}`.slice(0, 200)
  if (!firstTime(key)) return
  try {
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // 报错时常跟着页面跳转或关闭，不带 keepalive 的请求会被直接取消
      keepalive: true,
      body: JSON.stringify({
        level: 'error',
        msg: msg.slice(0, MAX_MSG),
        stack: String(stack ?? '').slice(0, MAX_STACK),
        url: location.href,
        ua: navigator.userAgent,
        build: __BUILD_AT__,
      }),
    }).catch(() => {})
  } catch {}
}

export function installErrorReporting() {
  // 没配端点就是没这个功能。跑在访客浏览器里的东西，缺配置不能让页面出任何动静
  if (!endpoint()) return

  window.addEventListener(
    'error',
    (e) => {
      if (e instanceof ErrorEvent) {
        // 跨域脚本报错拿不到堆栈，只剩一句 "Script error."，连 filename 都是空的 —— 没来源的一律丢
        if (ownOrigin(e.filename)) send(e.message, e.error?.stack ?? '')
        return
      }
      // 图片 / 字体 / 脚本加载失败：error 不冒泡，只能在这层捕获，且事件对象是元素不是 ErrorEvent
      const el = e.target
      const src = el?.src ?? el?.href ?? ''
      if (ownOrigin(src)) send(`load failed: ${src}`, '')
    },
    true,
  )

  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason
    send(
      `unhandledrejection: ${r instanceof Error ? r.message : String(r)}`,
      r instanceof Error ? r.stack : '',
    )
  })
}
