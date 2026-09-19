import { ref } from 'vue'

// 全站 z-index 的唯一来源。CSS 里改用 var(--z-xxx)，由 installZVariables() 注入 :root。
export const Z = {
  COMMAND: 1, // 左上角命令窗口
  COMMAND_FRONT: 2, // printf welcome 窗口，压在命令窗口上
  COMMENTS: 40,
  GALLERY: 50,
  FP: 100,

  WINDOW_BASE: 1000, // nextZ() 从这里开始递增
  ICON: 9998, // 桌面图标 .drag-top
  TOP_MOST: 9999, // 桌面图标创建的窗口
  MAXIMIZED: 10000, // 最大化窗口独占一层：高于图标和 top-most 窗，低于全屏效果层
  OVERLAY: 10010, // 太阳镜滤镜 / 火把暗幕 / DialogBox
  BANNER: 10011, // 切换横幅 / OptionBox
  TOAST: 20000,
}

// 把层级表写成 :root 的 CSS 变量，让样式和 JS 用的是同一份数字
export function installZVariables() {
  const root = document.documentElement
  for (const [name, value] of Object.entries(Z)) {
    root.style.setProperty(`--z-${name.toLowerCase().replace(/_/g, '-')}`, String(value))
  }
}

const counter = ref(Z.WINDOW_BASE)

export function nextZ() {
  return ++counter.value
}

// 同一时刻只允许一个窗口最大化：新窗口进来时先把上一个还原回去
let maximizedRelease = null
export function claimMaximized(release) {
  if (maximizedRelease && maximizedRelease !== release) maximizedRelease()
  maximizedRelease = release
}
export function releaseMaximized(release) {
  if (maximizedRelease === release) maximizedRelease = null
}
