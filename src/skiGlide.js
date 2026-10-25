/* 溜冰场模式的滑行：松手后按松手那一刻的速度继续走，撞到视口边反弹而不是滑出去。

   速度一律 px/s、衰减按「每秒剩多少」给 —— 按帧乘一个系数的话，高刷屏上滑行距离会短一半。
   两个调用方（PixelWindow 的两条拖动路径、v-draggable 指令）都只给「量矩形」和「挪多少」，
   位置怎么存由它们自己决定。 */

// 每秒剩下的速度比例：越小停得越快（0.3 ≈ 松手后还能滑出初速的 0.8 倍距离）
export const SKI_FRICTION = 0.3
// 慢到这个速度就停（px/s）
export const SKI_MIN_SPEED = 14
// 撞边后保留的速度比例
export const SKI_BOUNCE = 0.72
// 单帧最大步长（秒）：切标签页回来别一步跳很远
export const SKI_MAX_DT = 0.05
// 松手前多久没再动过就算「停住了」，不给初速（ms）
export const SKI_STALE_MS = 100

/**
 * @param {{getRect:() => DOMRect, move:(dx:number, dy:number) => void, vx:number, vy:number}} o
 * @returns {() => void} 取消滑行（下次按下时调，否则会被两段滑行同时推）
 */
export function startGlide({ getRect, move, vx, vy }) {
  let x = vx
  let y = vy
  let last = performance.now()
  let raf = 0

  function step(now) {
    const dt = Math.min((now - last) / 1000, SKI_MAX_DT)
    last = now
    move(x * dt, y * dt)
    const r = getRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    // 每轴独立判：越界就把这一段推回来、速度反向。只在「还在往那边走」时反向，
    // 否则贴着边的时候会被反复弹
    if (r.left < 0) {
      if (x < 0) x = -x * SKI_BOUNCE
      move(-r.left, 0)
    } else if (r.right > vw) {
      if (x > 0) x = -x * SKI_BOUNCE
      move(vw - r.right, 0)
    }
    if (r.top < 0) {
      if (y < 0) y = -y * SKI_BOUNCE
      move(0, -r.top)
    } else if (r.bottom > vh) {
      if (y > 0) y = -y * SKI_BOUNCE
      move(0, vh - r.bottom)
    }
    const k = Math.pow(SKI_FRICTION, dt)
    x *= k
    y *= k
    if (Math.hypot(x, y) < SKI_MIN_SPEED) {
      raf = 0
      return
    }
    raf = requestAnimationFrame(step)
  }

  raf = requestAnimationFrame(step)
  return () => {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }
}

/** 拖动过程中的速度采样：单帧位移抖得厉害，做一下平滑再拿去当初速 */
export function createVelSampler() {
  let px = 0
  let py = 0
  let pt = 0
  let vx = 0
  let vy = 0
  return {
    reset() {
      px = 0
      py = 0
      pt = 0
      vx = 0
      vy = 0
    },
    sample(x, y) {
      const now = performance.now()
      const dt = pt ? (now - pt) / 1000 : 0
      if (dt > 0) {
        vx = vx * 0.6 + ((x - px) / dt) * 0.4
        vy = vy * 0.6 + ((y - py) / dt) * 0.4
      }
      px = x
      py = y
      pt = now
    },
    take() {
      if (!pt || performance.now() - pt > SKI_STALE_MS) return { vx: 0, vy: 0 }
      return { vx, vy }
    },
  }
}
