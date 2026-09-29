import { DRAG_RATE, GRAVITY_SHARE, clamp } from './physics.js'

// 弹幕脚本的"能力表"：脚本里写 pattern 名，这里按名字查函数（跟 dpActions 一个套路）。
// ctx 由调用方给：cells（贴纸格子的中心与贴图）、vw / vh（视口）、player（自机中心）、playerSize。
// 每个 pattern 返回一批 spawn：{ src, x, y, size, vx, vy, move }；id 和注入时机由调度器管。
//   move = 'ballistic' 走阻力 + 重力（冲上去再落下），'linear' 匀速直飞、出界即弃。
// 分布一律按序号推算，不用 Math.random —— 随机的分布没法预览也没法复现。
// 新增一种弹幕 = 加一个具名导出 + SCHEMA 登记一条，组件和编辑器都不用改。

const RAD = Math.PI / 180
const ASCENT = 0.12 // 「刚够冲过屏幕顶部」所需的上升高度里，顶部以上的余量（视口高度比例）
// 实际最高点 = 刚够过顶的高度 × 这个倍数。飞得越高回来越晚，整片因此错开时间落下 ——
// 全队同一个高度就是"一堵墙砸下来"，没有缝可钻。
const APEX_SCALE = { min: 1, max: 1.7 }
const UP_SPEED = { min: 1.2, max: 6 } // px/ms 向上初速的反推结果夹在这里
const SPREAD = 0.7 // 横向落点在各自槽位内的抖动幅度（占一个槽位宽度的比例）
const DROP_SPREAD = 0.15 // from='top' 时起点在屏幕上方的错开幅度（视口高度比例）
// 按序号造一个 -1..1 的确定值：random 换成正弦，分布才有规律可看、可预览
function wave(i, phase) {
  return Math.sin(i * phase)
}

function seedAt(ctx, i) {
  return ctx.cells[i % ctx.cells.length]
}

function make(ctx, i, size, x, y, vx, vy, move) {
  return { src: seedAt(ctx, i).src, size, x: x - size / 2, y: y - size / 2, vx, vy, move }
}

function pointOf(v, vw, vh, def) {
  return {
    x: (v?.x ?? def.x) * vw,
    y: (v?.y ?? def.y) * vh,
  }
}

// 贴纸格子那一簇的中心（视口比例）。grid 起点的默认位置就是它 —— 起点没被拖过时等于不动。
export function cellsCenter(ctx) {
  const cells = ctx.cells || []
  if (!cells.length) return { x: 0.5, y: 0.55 }
  let sx = 0
  let sy = 0
  for (const c of cells) {
    sx += c.x
    sy += c.y
  }
  return { x: sx / cells.length / ctx.vw, y: sy / cells.length / ctx.vh }
}

// 整片冲过屏幕顶部后按槽位落下。贴纸不够就按序号循环补足。
export function burst(ctx, opts = {}) {
  const from = opts.from ?? 'grid'
  const count = opts.count ?? ctx.cells.length
  const lanes = opts.lanes ?? count
  const scale = opts.size ?? 1
  const rise = opts.rise ?? [APEX_SCALE.min, APEX_SCALE.max]
  const spread = opts.spread ?? SPREAD

  const center = cellsCenter(ctx)
  const o = pointOf(opts.origin, ctx.vw, ctx.vh, center)
  const shift = { x: o.x - center.x * ctx.vw, y: o.y - center.y * ctx.vh }
  const slot = ctx.vw / lanes
  const list = []
  for (let i = 0; i < count; i++) {
    const s = seedAt(ctx, i)
    const size = s.size * scale
    const jitter = wave(i, 2.3) * 0.5 * slot * spread

    // 横向：按序号把落点均分到整屏宽度（各带一点偏移）。极限位移 = vx / DRAG_RATE，反着用
    // 就是"让我落到第 i 号槽位"。
    const targetX = ((i % lanes) + 0.5) * slot + jitter

    // 起点在屏幕上方时不用冲顶，直接靠重力落下来
    if (from === 'top') {
      list.push(
        make(
          ctx,
          i,
          size,
          targetX,
          -size - Math.abs(wave(i, 1.1)) * ctx.vh * DROP_SPREAD,
          0,
          0,
          'ballistic',
        ),
      )
      continue
    }

    // point 从那个点起爆；grid 从贴纸格子起爆，origin 拖到哪就把整簇平移到哪
    const start =
      from === 'point' ? o : { x: s.x + shift.x, y: s.y + shift.y }

    // 纵向：整片先冲过屏幕顶部。起点会随拖拽/窗口位置变，所以按各自起点反推所需初速，
    // 而不是给固定值 —— 否则窗口一低就冲不上去，又变成在中途四散。
    const bare = start.y + ctx.vh * ASCENT
    const riseH = bare * (rise[0] + ((wave(i, 1.7) + 1) / 2) * (rise[1] - rise[0]))
    const vUp = clamp((riseH * DRAG_RATE) / GRAVITY_SHARE, UP_SPEED.min, UP_SPEED.max)

    list.push(make(ctx, i, size, start.x, start.y, (targetX - start.x) * DRAG_RATE, -vUp, 'ballistic'))
  }
  return list
}

// 一堵墙压下来，按 origin.x 的位置留一道缺口
export function wall(ctx, opts = {}) {
  const count = opts.count ?? 24
  const scale = opts.size ?? 1
  const speed = opts.speed ?? 0.25
  const gapW = opts.gap ?? 0.18
  const o = pointOf(opts.origin, ctx.vw, ctx.vh, { x: 0.5, y: 0.1 })

  const size = (ctx.cells[0]?.size ?? 64) * scale
  const slot = ctx.vw / count
  const gapL = o.x - (gapW * ctx.vw) / 2
  const gapR = o.x + (gapW * ctx.vw) / 2

  const list = []
  for (let i = 0; i < count; i++) {
    const cx = (i + 0.5) * slot
    if (cx > gapL && cx < gapR) continue
    list.push(make(ctx, i, size, cx, o.y, 0, speed, 'linear'))
  }
  return list
}

// 从一个点向四周成环扩散：radius 是起点离圆心的距离，占短边比例
export function ring(ctx, opts = {}) {
  const count = opts.count ?? 24
  const scale = opts.size ?? 1
  const speed = opts.speed ?? 0.3
  const radius = opts.radius ?? 0.08
  const c = pointOf(opts.center, ctx.vw, ctx.vh, { x: 0.5, y: 0.4 })

  const size = (ctx.cells[0]?.size ?? 64) * scale
  const r = radius * Math.min(ctx.vw, ctx.vh)
  const list = []
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    list.push(
      make(ctx, i, size, c.x + dx * r, c.y + dy * r, dx * speed, dy * speed, 'linear'),
    )
  }
  return list
}

// 朝某个角度张开一扇：angle 是中心朝向（度，90 = 向下），spread 是张角
export function fan(ctx, opts = {}) {
  const count = opts.count ?? 12
  const scale = opts.size ?? 1
  const speed = opts.speed ?? 0.3
  const angle = opts.angle ?? 90
  const spreadAng = opts.spread ?? 60
  const o = pointOf(opts.origin, ctx.vw, ctx.vh, { x: 0.5, y: 0.15 })

  const size = (ctx.cells[0]?.size ?? 64) * scale
  const list = []
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) - 0.5 : 0
    const a = (angle + t * spreadAng) * RAD
    list.push(make(ctx, i, size, o.x, o.y, Math.cos(a) * speed, Math.sin(a) * speed, 'linear'))
  }
  return list
}

// 朝自机方向打：中心指向自机当前位置，spread 是散布角（0 = 全部同一条线）
export function aim(ctx, opts = {}) {
  const count = opts.count ?? 5
  const scale = opts.size ?? 1
  const speed = opts.speed ?? 0.45
  const spreadAng = opts.spread ?? 12
  const o = pointOf(opts.origin, ctx.vw, ctx.vh, { x: 0.5, y: 0.15 })

  const target = ctx.player ?? { x: ctx.vw / 2, y: ctx.vh * 0.75 }
  const base = Math.atan2(target.y - o.y, target.x - o.x)

  const size = (ctx.cells[0]?.size ?? 64) * scale
  const list = []
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) - 0.5 : 0
    const a = base + t * spreadAng * RAD
    list.push(make(ctx, i, size, o.x, o.y, Math.cos(a) * speed, Math.sin(a) * speed, 'linear'))
  }
  return list
}

// 从一个点朝一个方向吐一串：spacing 是相邻两发的间距
export function emit(ctx, opts = {}) {
  const count = opts.count ?? 8
  const scale = opts.size ?? 1
  const speed = opts.speed ?? 0.35
  const angle = opts.angle ?? 0
  const spacing = opts.spacing ?? 40
  const o = pointOf(opts.origin, ctx.vw, ctx.vh, { x: 0.1, y: 0.15 })

  const size = (ctx.cells[0]?.size ?? 64) * scale
  const dx = Math.cos(angle * RAD)
  const dy = Math.sin(angle * RAD)
  const list = []
  for (let i = 0; i < count; i++) {
    list.push(
      make(ctx, i, size, o.x + dx * spacing * i, o.y + dy * spacing * i, dx * speed, dy * speed, 'linear'),
    )
  }
  return list
}

// 可调参数声明：pattern 自己说清有哪些参数、范围和默认值。
//   point = 这个参数是画布上的一个控制点（值是 { x, y }，都按视口比例存），编辑器画成可拖的点。
//   angle = 这个参数是朝向（度），编辑器的镜像按钮要连方向一起翻。
//   only  = 只在另一个参数取这些值之一时才出现（`{ key, in: [...] }`），免得画出拖了没反应的死控件。
//   anchor='cells' = 这个点默认跟着格子簇的中心走（origin 没拖过时等于不动）。
// 调参面板照这份渲染控件 —— 加一种弹幕，登记一条就有控件，不用改面板。
export const SCHEMA = {
  burst: [
    { key: 'from', label: '起点', values: ['grid', 'top', 'point'], def: 'grid' },
    { key: 'count', label: '弹数', min: 1, max: 200, step: 1, def: 60 },
    { key: 'lanes', label: '槽位', min: 1, max: 120, step: 1, def: 60 },
    { key: 'size', label: '尺寸', min: 0.2, max: 2, step: 0.05, def: 1 },
    { key: 'rise', label: '升幅', min: 0.5, max: 3, step: 0.05, pair: true, def: [1, 1.7] },
    { key: 'spread', label: '偏移', min: 0, max: 1, step: 0.05, def: 0.7 },
    {
      key: 'origin',
      label: '起点位置',
      point: true,
      anchor: 'cells',
      def: { x: 0.5, y: 0.55 },
      only: { key: 'from', in: ['grid', 'point'] },
    },
  ],
  wall: [
    { key: 'count', label: '弹数', min: 2, max: 120, step: 1, def: 24 },
    { key: 'size', label: '尺寸', min: 0.2, max: 2, step: 0.05, def: 1 },
    { key: 'speed', label: '速度', min: 0.02, max: 1.5, step: 0.01, def: 0.25 },
    { key: 'origin', label: '墙（横向=缺口位置，纵向=起始高度）', point: true, def: { x: 0.5, y: 0.1 } },
    { key: 'gap', label: '缺口宽', min: 0, max: 0.6, step: 0.01, def: 0.18 },
  ],
  ring: [
    { key: 'count', label: '弹数', min: 3, max: 120, step: 1, def: 24 },
    { key: 'size', label: '尺寸', min: 0.2, max: 2, step: 0.05, def: 1 },
    { key: 'speed', label: '速度', min: 0.02, max: 1.5, step: 0.01, def: 0.3 },
    { key: 'center', label: '圆心', point: true, def: { x: 0.5, y: 0.4 } },
    { key: 'radius', label: '半径', min: 0, max: 0.5, step: 0.01, def: 0.08 },
  ],
  fan: [
    { key: 'count', label: '弹数', min: 1, max: 120, step: 1, def: 12 },
    { key: 'size', label: '尺寸', min: 0.2, max: 2, step: 0.05, def: 1 },
    { key: 'speed', label: '速度', min: 0.02, max: 1.5, step: 0.01, def: 0.3 },
    { key: 'origin', label: '原点', point: true, def: { x: 0.5, y: 0.15 } },
    { key: 'angle', label: '朝向', min: -180, max: 180, step: 1, angle: true, def: 90 },
    { key: 'spread', label: '张角', min: 1, max: 360, step: 1, def: 60 },
  ],
  aim: [
    { key: 'count', label: '弹数', min: 1, max: 60, step: 1, def: 5 },
    { key: 'size', label: '尺寸', min: 0.2, max: 2, step: 0.05, def: 1 },
    { key: 'speed', label: '速度', min: 0.02, max: 1.5, step: 0.01, def: 0.45 },
    { key: 'origin', label: '发射点', point: true, def: { x: 0.5, y: 0.15 } },
    { key: 'spread', label: '散布角', min: 0, max: 180, step: 1, def: 12 },
  ],
  emit: [
    { key: 'count', label: '弹数', min: 1, max: 60, step: 1, def: 8 },
    { key: 'size', label: '尺寸', min: 0.2, max: 2, step: 0.05, def: 1 },
    { key: 'speed', label: '速度', min: 0.02, max: 1.5, step: 0.01, def: 0.35 },
    { key: 'origin', label: '发射点', point: true, def: { x: 0.1, y: 0.15 } },
    { key: 'angle', label: '朝向', min: -180, max: 180, step: 1, angle: true, def: 0 },
    { key: 'spacing', label: '间距', min: 0, max: 200, step: 2, def: 40 },
  ],
}
