// 飘雪的触发状态，做成模块单例是因为触发点（对话框里的 * 提示符，被 Teleport 到 body）
// 和播放点（HomeView 里的 SnowLayer）不在同一条组件链上，逐层 emit 要跨好几层还容易漏
import { ref } from 'vue'

export const snowActive = ref(false)

// 提示符雪花的落点（视口坐标 + 字号），从动画随机生成的大雪花里面随机挑一个取初始坐标
export const snowSeed = ref(null)

export function playSnow(seed = null) {
  snowSeed.value = seed
  snowActive.value = true
}

export function stopSnow() {
  snowActive.value = false
  snowSeed.value = null
}
