// DP 详情窗按钮的行为：一个按钮一个函数，这种 project 性质的东西不考虑复用了，太难搞了。
//
// 这些函数集中在这里具名导出，HomeView 用 `import * as dpActions` 整体引入后，
// 按 JSON 里写的名字取用（dpActions[name]）。整体引入是必要的 —— 只被字符串
// 引用的函数会被打包器摇掉，结果是 dev 正常、build 之后按钮点了没反应。
//
// JSON 里 button.on[*] 写的就是这里的导出名，改导出名要同步改 content.json。
// 取不到对应函数时什么都不做：不抛错，也不打日志（站点 console 面向访客）。

import { ref } from 'vue'

// 把一套光标注入成全局样式。只有 DP 预览用得到，故不导出。
function applyCursorPreview(cursors, base = '') {
  const styleId = 'dp-cursor-preview'
  const existing = document.getElementById(styleId)
  if (existing) {
    existing.remove()
  }
  if (!cursors) return

  // 相对路径（非 http(s):// 且非 / 开头）按 base 拼接；绝对 URL 原样返回
  const resolve = (u) => {
    if (!u) return u
    if (/^https?:\/\//.test(u) || u.startsWith('/')) return u
    return `${base.replace(/\/$/, '')}/${u.replace(/^\//, '')}`
  }

  // 每个光标可写成字符串 URL，或 { url, hotspot:[x,y] } 对象（热点为可选）
  const specOf = (key) => {
    const v = cursors[key]
    if (!v) return null
    if (typeof v === 'string') return { url: resolve(v), hotspot: null }
    return { url: resolve(v.url), hotspot: v.hotspot || null }
  }
  const expr = (key, fallback) => {
    const s = specOf(key)
    if (!s) return ''
    const ok = Array.isArray(s.hotspot) && s.hotspot.length === 2 && s.hotspot.every((n) => typeof n === 'number')
    const hs = ok ? ` ${s.hotspot[0]} ${s.hotspot[1]}` : ''
    return `url("${s.url}")${hs}, ${fallback}`
  }

  const groups = [
    { key: 'default', fallback: 'auto', selector: 'html, body' },
    { key: 'pointer', fallback: 'pointer', selector: 'a, button, [role="button"], input[type="submit"], input[type="button"], label, .tab, .gallery-thumb, .social-item, .social-email, .doujin-item, .dp-detail-btn, .page-arrow, .desktop-icon' },
    { key: 'text', fallback: 'text', selector: 'p, li, td, th, h1, h2, h3, h4, h5, h6, blockquote, pre, code, dt, dd, figcaption, summary, [contenteditable], input[type="text"], input[type="email"], input[type="password"], input[type="search"], textarea, .dp-detail-text, .detail-desc' },
    { key: 'help', fallback: 'help', selector: '.dp-help-icon' },
    { key: 'move', fallback: 'move', selector: '[draggable="true"], .pixel-titlebar, .doujin-header, .desktop-icon.is-dragging, .power-btn.is-dragging' },
    { key: 'not-allowed', fallback: 'not-allowed', selector: '[disabled], [aria-disabled="true"]' },
    { key: 'wait', fallback: 'wait', selector: 'html.dp-cursor-wait, html.dp-cursor-wait *' },
    { key: 'progress', fallback: 'progress', selector: 'html.dp-cursor-progress, html.dp-cursor-progress *' },
    { key: 'ew-resize', fallback: 'ew-resize', selector: '[data-resize="ew"], .resize-ew, [data-resize="ew"] *, .resize-ew *' },
    { key: 'ns-resize', fallback: 'ns-resize', selector: '[data-resize="ns"], .resize-ns, [data-resize="ns"] *, .resize-ns *' },
    { key: 'nesw-resize', fallback: 'nesw-resize', selector: '[data-resize="nesw"], .resize-nesw, [data-resize="nesw"] *, .resize-nesw *' },
    { key: 'nwse-resize', fallback: 'nwse-resize', selector: '[data-resize="nwse"], .resize-nwse, [data-resize="nwse"] *, .resize-nwse *' },
  ]

  const rules = []
  for (const g of groups) {
    const e = expr(g.key, g.fallback)
    if (e) rules.push(`${g.selector} { cursor: ${e} !important; }`)
  }

  if (rules.length === 0) return
  const style = document.createElement('style')
  style.id = styleId
  style.textContent = rules.join('\n')
  document.head.appendChild(style)
}

// 组件卸载时清掉注入的光标样式，避免全局残留
export function clearCursorPreview() {
  document.getElementById('dp-cursor-preview')?.remove()
}

// DOWNLOAD：跳到条目的下载链接
export function floweryDownload({ item }) {
  if (!item?.downloadUrl || item.downloadUrl === '#') return
  const a = document.createElement('a')
  a.href = item.downloadUrl
  a.target = '_blank'
  a.download = item.title || 'cursor-set'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

// PREVIEW / RESET：把该条目的光标套到全站，再次点击还原
export function floweryPreview({ item, base, active, setActive }) {
  const next = !active
  setActive(next)
  applyCursorPreview(next ? item?.cursors || null : null, base)
}

// 浮层 tooltip：内容统一取触发它的那个按钮的 tooltip 字段（可以是 HTML）
export function tooltipShow({ button, setTooltip }) {
  setTooltip(button?.tooltip || '')
}

export function tooltipHide({ setTooltip }) {
  setTooltip('')
}

// PREVIEW 触发的贴纸弹幕游戏：按钮动作和预览区内容分居两处（一个在父级执行、
// 一个在 slot 里渲染），靠这个计数器指到同一件事上 —— 每点一次 +1，
// StickerStg.vue watch 到就重开一局。用计数而不是布尔开关，是为了让
// 「游戏中再点 PREVIEW」也能重开，不用先回到 idle。
export const stickerStgRun = ref(0)

export function ahogecatPreview() {
  stickerStgRun.value++
}

// DOWNLOAD：跳到条目的下载链接
export function ahogecatDownload({ item }) {
  if (!item?.downloadUrl || item.downloadUrl === '#') return
  const a = document.createElement('a')
  a.href = item.downloadUrl
  a.target = '_blank'
  a.download = item.title || 'sticker-set'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
