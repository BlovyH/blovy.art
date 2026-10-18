import { ref } from 'vue'

/* 逐帧转盘的拖动带惯性和飞起来 */

export const SPIN_PX_PER_FRAME = 20 // 拖多远转一帧(px)
const SPIN_FRICTION = 0.94 // 松手后每帧衰减
const SPIN_MIN_VEL = 0.02 // 慢于此就停，免得永远滑
const SPIN_MAX_STEP = 1 // 每帧最多走几个画面帧，用来限制跳帧
const SPIN_MAX_LAG = 9 // 显示最多欠目标多少帧，否则会松手后转个没完
const SPIN_SPEED_SMOOTH = 0.35 // 读数平滑系数
const SPIN_HYPER_FPS = SPIN_MAX_STEP * 222 // rAF 约 60 次/秒 × 每帧最多追的画面帧，判定高速旋转用（要不要单独出一个模糊贴图啊）
const SPIN_HYPER_STREAK = 3 // 触发飞起来的连续高速旋转次数
const SPIN_HYPER_VEL = 2 // 起飞前每 rAF 推进多少画面帧，大于 SPIN_MAX_STEP 才会糊成一坨
const SPIN_FLYAWAY_DELAY_MS = 1000 // 停顿多久飞起来
const SPIN_FLY_SPEED = 40 // 飞起来上升速度 px/s
const SPIN_MAX_DT = 0.1 // 空转推进的时间步长上限，切到后台再回来别一次跳一大段

export function createSpinControl({ frames, idleFps = 0, el, varName, onFrame, enabled }) {
  const locked = ref(false)
  const flying = ref(false)
  const gone = ref(false)
  const speedShown = ref(0)

  let pos = 0
  let target = 0
  let vel = 0
  let dragging = false
  let lastX = 0
  let lastMoveAt = 0
  let raf = 0
  let speed = 0
  let hyperThisDrag = false
  let hyperStreak = 0
  let flyRaf = 0
  let flyLast = 0
  let flyY = 0
  let lastTickAt = 0

  const canUse = () => (enabled ? enabled() : true)

  function sync() {
    const total = Math.round(pos)
    // 帧序方向是往左转的（相反）
    const index = ((-total % frames) + frames) % frames
    el?.value?.style.setProperty(varName, index)
    onFrame?.(index, total)
  }

  function ensureRaf() {
    if (!raf) raf = requestAnimationFrame(tick)
  }

  function tick(now) {
    raf = 0
    // 空转按时间推进，不能按帧，高刷屏会转得更快
    const dt = lastTickAt ? Math.min((now - lastTickAt) / 1000, SPIN_MAX_DT) : 0
    lastTickAt = now
    if (!dragging) {
      target += vel
      if (!locked.value) {
        vel *= SPIN_FRICTION
        if (Math.abs(vel) < SPIN_MIN_VEL) vel = 0
      }
      // 惯性
      if (vel === 0 && idleFps) target -= idleFps * dt
    }
    const diff = target - pos
    const step = Math.abs(diff) > SPIN_MAX_STEP ? Math.sign(diff) * SPIN_MAX_STEP : diff
    pos += step
    sync()
    if (Math.abs(target - pos) > 0.001 || vel !== 0 || idleFps) ensureRaf()
    // 循环停下才清零计时
    else lastTickAt = 0
  }

  function down(e) {
    if (locked.value || !canUse()) return
    dragging = true
    vel = 0
    speed = 0
    speedShown.value = 0
    hyperThisDrag = false
    lastX = e.clientX
    lastMoveAt = Date.now()
    // 指针拖出图外仍要跟手
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  function move(e) {
    if (locked.value || !dragging) return
    const now = Date.now()
    const px = e.clientX - lastX
    const delta = px / SPIN_PX_PER_FRAME
    // 速度 = 相邻两次 move 的位移除以间隔；连续两次 move 可能同一毫秒，dt 为 0 就跳过
    const dt = now - lastMoveAt
    if (dt > 0) {
      speed += ((px / dt) * 1000 - speed) * SPIN_SPEED_SMOOTH
      speedShown.value = speed
    }
    if (!hyperThisDrag && Math.abs(speed) / SPIN_PX_PER_FRAME >= SPIN_HYPER_FPS) {
      hyperThisDrag = true
      hyperStreak += 1
      if (hyperStreak >= SPIN_HYPER_STREAK) {
        startFlyaway()
        return
      }
    }
    lastX = e.clientX
    lastMoveAt = now
    target += delta
    // 追不上就把目标拽回来一点，连着快拖会让欠账越积越多，松手后转个没完
    const lag = target - pos
    if (Math.abs(lag) > SPIN_MAX_LAG) target = pos + Math.sign(lag) * SPIN_MAX_LAG
    // move 的频率约等于 rAF，最后一次位移就是松手初速
    vel = delta
    ensureRaf()
  }

  function up() {
    if (locked.value || !dragging) return
    dragging = false
    // 连续才计数，某次速度没达到就清零
    if (!hyperThisDrag) hyperStreak = 0
    // 停住不动再松手不该滑行，最后一次 move 太久远就当没速度
    if (Date.now() - lastMoveAt > 60) vel = 0
    ensureRaf()
  }

  // 飞起来的时候锁交互（手动转动、标题栏拖拽）
  function startFlyaway() {
    locked.value = true
    dragging = false
    vel = (Math.sign(speed) || 1) * SPIN_HYPER_VEL
    ensureRaf()
    setTimeout(() => {
      flying.value = true
      startFlyUp()
    }, SPIN_FLYAWAY_DELAY_MS)
  }

  // 上升走 rAF 逐帧写 --fly-y 且按元素真实位置判断何时飞出了视口
  function startFlyUp() {
    flyY = 0
    flyLast = performance.now()
    flyRaf = requestAnimationFrame(stepFlyUp)
  }

  function stepFlyUp(now) {
    const node = el?.value
    if (!node) return
    const dt = (now - flyLast) / 1000
    flyLast = now
    flyY -= SPIN_FLY_SPEED * dt
    node.style.setProperty('--fly-y', flyY + 'px')
    if (node.getBoundingClientRect().bottom < 0) {
      flyRaf = 0
      gone.value = true
      return
    }
    flyRaf = requestAnimationFrame(stepFlyUp)
  }

  function dispose() {
    cancelAnimationFrame(raf)
    cancelAnimationFrame(flyRaf)
    raf = 0
    flyRaf = 0
  }

  function start() {
    ensureRaf()
  }

  return { locked, flying, gone, speedShown, down, move, up, start, dispose }
}
