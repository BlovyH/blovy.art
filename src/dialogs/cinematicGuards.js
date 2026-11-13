// 演出对话自动恢复前的条件，按 flow key 登记
const guards = new Map()

export function registerRestoreGuard(key, fn) {
  guards.set(key, fn)
}

export function shouldRestore(key) {
  const guard = guards.get(key)
  return guard ? guard() : true
}
