import { ref } from 'vue'

// 手电筒开关，光晕与显现内容共用
export const torchOn = ref(false)

// 光斑的视口坐标
export const torchPointer = {
  x: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
  y: typeof window !== 'undefined' ? window.innerHeight / 2 : 0,
}

// 光斑位置随光晕重绘一起更新
export function setTorchPointer(x, y) {
  torchPointer.x = x
  torchPointer.y = y
}

const frameUpdaters = new Set()

// 锚定元素把定位更新注册进来，由显现层逐帧统一驱动
export function onTorchFrame(fn) {
  frameUpdaters.add(fn)
  return () => frameUpdaters.delete(fn)
}

export function runTorchFrame() {
  for (const fn of frameUpdaters) fn()
}
