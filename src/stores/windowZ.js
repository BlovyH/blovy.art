import { ref } from 'vue'

const baseZ = 1000
const counter = ref(baseZ)

export function nextZ() {
  return ++counter.value
}

// 最大化窗口独占一层：高于桌面图标（9998）和图标绑定的窗口（9999），
// 低于全屏效果层（10010）——放大镜 / 火把暗幕照旧盖在它上面。
export const Z_MAXIMIZED = 10000

// 同一时刻只允许一个窗口最大化：新窗口进来时先把上一个还原回去
let maximizedRelease = null
export function claimMaximized(release) {
  if (maximizedRelease && maximizedRelease !== release) maximizedRelease()
  maximizedRelease = release
}
export function releaseMaximized(release) {
  if (maximizedRelease === release) maximizedRelease = null
}
