// 撞击特效：闪白 + 一圈飞散的「+」。iy 对撞和后院「花变成蛋糕」共用一套
// （配套的 CSS 在 src/assets/styles/shared.css 的 .fx-* / @keyframes fx-*）。
//
// 这里只出纯数据：每颗粒子的起点、落点、大小、时长当场随机好，组件按 style 原样渲染。
// 撒点是「围着矩形外面那一圈」而不是整屏、也不是从中心往外炸 —— 密度靠 out 的幂律往边缘压。

const PARTICLE_COUNT = 90
const PARTICLE_GAP = 28 // 生成起点离矩形边缘多远
const PARTICLE_BAND = 170 // 往外最多飞多远
const PARTICLE_DROP = 16 // 落点比直线终点再低一点
const PARTICLE_DROP_VAR = 20
const PARTICLE_SWAY = 46 // 左右摆动幅度
const PARTICLE_OP_MIN = 0.35
const PARTICLE_SIZE_MIN = 12
const PARTICLE_SIZE_STEP = 4
const PARTICLE_SIZE_STEPS = 7
const PARTICLE_DUR = 800
const PARTICLE_DUR_VAR = 1400 // 飞得越远活得越久
const PARTICLE_DUR_JITTER = 300
const PARTICLE_DELAY_VAR = 220 // 启动时间错开，不要齐步走

// 一次爆发的总寿命：错开 + 最长时长。收尾不能靠演出自己结束，粒子活得比那一刻长
export const BURST_MS =
  PARTICLE_DELAY_VAR + PARTICLE_DUR + PARTICLE_DUR_VAR + PARTICLE_DUR_JITTER

// rect = 围着它撒粒子的那个矩形（不传就当撞击发生在视口中心、矩形为一个点）
// origin = 粒子坐标相对哪个点（通常是撞击点，容器就挂在那里）
export function makeImpactParticles(rect, origin = null, count = PARTICLE_COUNT) {
  const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
  const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2
  const bx = (rect ? rect.width : 0) / 2 + PARTICLE_GAP
  const by = (rect ? rect.height : 0) / 2 + PARTICLE_GAP
  const ox = origin ? origin.x : cx
  const oy = origin ? origin.y : cy
  const list = []
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2
    const ux = Math.cos(a)
    const uy = Math.sin(a)
    // 从框心沿这个方向走到框边（含 gap）的距离
    const edge = Math.min(bx / (Math.abs(ux) || 1e-3), by / (Math.abs(uy) || 1e-3))
    // 靠近框的地方密一点，远离框的地方疏一点
    const out = Math.random() ** 1.6 * PARTICLE_BAND
    const sx = cx + ux * edge * 0.99
    const sy = cy + uy * edge * 0.99
    const ex = cx + ux * (edge + out)
    const ey = cy + uy * (edge + out)
    const far = Math.min(1, out / PARTICLE_BAND)
    list.push({
      id: i,
      style: {
        '--p-x0': (sx - ox).toFixed(1) + 'px',
        '--p-y0': (sy - oy).toFixed(1) + 'px',
        '--p-x': (ex - ox).toFixed(1) + 'px',
        '--p-y': (ey - oy).toFixed(1) + 'px',
        '--p-drop': (PARTICLE_DROP + Math.random() * PARTICLE_DROP_VAR).toFixed(1) + 'px',
        '--p-sway': ((Math.random() * 2 - 1) * PARTICLE_SWAY).toFixed(1) + 'px',
        '--p-op': (PARTICLE_OP_MIN + Math.random() * (1 - PARTICLE_OP_MIN)).toFixed(2),
        fontSize:
          PARTICLE_SIZE_MIN +
          Math.floor(Math.random() * PARTICLE_SIZE_STEPS) * PARTICLE_SIZE_STEP +
          'px',
        animationDuration:
          Math.round(PARTICLE_DUR + far * PARTICLE_DUR_VAR + Math.random() * PARTICLE_DUR_JITTER) +
          'ms',
        animationDelay: Math.round(Math.random() * PARTICLE_DELAY_VAR) + 'ms',
      },
    })
  }
  return list
}
