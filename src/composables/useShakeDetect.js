// 晃动检测：喂入一串位置点，判定用户是不是在「原地来回甩」某个东西。
//
// 典型用法（拖拽窗口时抖动检测）：
//   const shake = useShakeDetect(() => doSomething())
//   // 拖拽中每个位置点：
//   shake.push(x, y)
//   // 拖拽结束（或任意想中断检测的时机）：
//   shake.reset()
//
// 判定只看「滑动时间窗」内的点，三条同时满足才算晃动：
//   1. 路径总长够大      —— 确实动了不少，不是手抖
//   2. 净位移远小于路径长 —— 走了很多路但没走远，说明在原地来回
//   3. 方向反转次数够多   —— 真的来回甩了，不是画圈/单向拖
// 触发后进冷却，避免一次甩动连续触发多次。
// 所有阈值都是「相对时间窗」计算的，与时间窗长度解耦，调常量不会互相打架。

// 采样窗口：只保留最近这段时间内的点（ms）
const WINDOW_MS = 1200
// 窗口内路径总长下限（px）
const MIN_PATH = 400
// 净位移 / 路径总长 的上限：越小代表「晃得越原地」
const MAX_NET_RATIO = 0.25
// 窗口内「有效回摆」次数下限——见 detect() 里的 MIN_SWING，抖一下不算回摆
const MIN_REVERSALS = 3
// 一次回摆前，沿同一方向至少要甩出这么长（px）才计入；低于此的来回视为拖动中的抖动
const MIN_SWING = 45
// 小于这个步长的移动直接忽略（抖噪/亚像素）
const MIN_STEP = 2
// 触发后的冷却时间（ms）
const COOLDOWN_MS = 2000

export function useShakeDetect(onShake) {
  let points = [] // [{ x, y, t }]，始终按时间裁剪到 WINDOW_MS 内
  let cooldownUntil = 0

  function push(x, y) {
    const now = performance.now()
    if (now < cooldownUntil) return
    points.push({ x, y, t: now })
    while (points.length > 1 && now - points[0].t > WINDOW_MS) points.shift()
    if (detect()) {
      reset()
      cooldownUntil = now + COOLDOWN_MS
      onShake()
    }
  }

  // 只在当前窗口内的点上计算，裁剪后不会残留旧数据。
  function detect() {
    if (points.length < 4) return false
    let path = 0
    let reversals = 0
    let axis = '' // 当前主轴：'x' | 'y'
    let dir = 0 // 当前主轴上的方向
    let swing = 0 // 上次转向以来沿主轴累计的位移
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x
      const dy = points[i].y - points[i - 1].y
      const step = Math.hypot(dx, dy)
      if (step < MIN_STEP) continue
      path += step
      const a = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'
      const m = a === 'x' ? dx : dy
      const s = Math.sign(m)
      if (a !== axis) {
        // 换轴 = 换了一段摆动，之前那截作废，从这一步重新起算
        axis = a
        dir = s
        swing = Math.abs(m)
        continue
      }
      if (s !== 0 && s !== dir) {
        // 只有刚才那一甩够长（MIN_SWING）才算一次真正的回摆，
        // 否则「快速拖动中抖一下继续走」也会被当成来回，导致过于灵敏。
        if (swing >= MIN_SWING) reversals++
        dir = s
        swing = 0
      }
      swing += Math.abs(m)
    }
    if (path < MIN_PATH || reversals < MIN_REVERSALS) return false
    const net = Math.hypot(
      points[points.length - 1].x - points[0].x,
      points[points.length - 1].y - points[0].y
    )
    return net <= path * MAX_NET_RATIO
  }

  function reset() {
    points = []
  }

  return { push, reset }
}

export default useShakeDetect
