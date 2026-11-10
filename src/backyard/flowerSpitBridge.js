// 转接吐花层的吸入调用，让不相临的组件也能发起
let suckInto = null

export function registerFlowerSuck(fn) {
  suckInto = fn
}

export function suckFlowers() {
  return suckInto?.() ?? false
}
