<template>
  <IndirectyWindow
    v-for="w in windows"
    :key="w.key"
    :ref="(el) => setWinRef(w.key, el)"
    :anchor="w.anchor"
    :frozen="duelling"
    :bubble="bubbleOn ? BUBBLE_TEXT : ''"
    :bubble-side="w.side"
    :bubble-below="w.below"
    :bubble-leaving="bubbleLeaving"
    :settling="settling"
    @close="onWinClose(w.key)"
  />
  <template v-if="burstOn">
    <div class="iy-duel-burst" :style="burstStyle" aria-hidden="true">
      <span v-for="p in particles" :key="p.id" class="iy-duel-particle" :style="p.style">+</span>
    </div>
  </template>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import IndirectyWindow from './IndirectyWindow.vue'

const emit = defineEmits(['close'])

/* 神秘 iy 转转转前摇 */
const BUBBLE_TEXT = '!'
const BUBBLE_DELAY_MS = 500
const BUBBLE_SHOW_MS = 1500
const BUBBLE_FADE_MS = 220

/* 神秘 iy 转转转 */
const APPROACH_MS = 900
const SPIN_MS = 1600 // 加速段
const WINDUP_MS = 1200 // 后撤蓄力段
const WINDUP_OUT = 0.8 // 蓄力时半径往外拉这么多（相对原半径）
const WINDUP_END_RPS = 0.8
const WINDUP_RPS_DELAY_MS = 100
const WINDUP_HOLD_MS = 180
const COLLAPSE_MS = 300 // 转转转半径收缩，对撞
const MERGE_MS = 160 // 撞上之后第二个窗口还留这么久，跟第一个一起抖完再消失
const FLASH_MS = 900
const SETTLE_MS = 460
const SPIN_START_RPS = 0.32 // 起步期结束时的速度（圈 / 秒）
const SPIN_END_RPS = 2.2 // 撞之前的速度

// bezier
const WINDUP_SPREAD_EASE = [0.01, 0.9, 0.019, 1.3]
const WINDUP_RPS_EASE = [0.01, 0.9, 0.485, 1.3]

function cubicBezier([x1, y1, x2, y2]) {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const fx = (t) => ((ax * t + bx) * t + cx) * t
  const fy = (t) => ((ay * t + by) * t + cy) * t
  const dfx = (t) => (3 * ax * t + 2 * bx) * t + cx
  return (x) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 8; i++) {
      const d = fx(t) - x
      if (Math.abs(d) < 1e-6) return fy(t)
      const s = dfx(t)
      if (Math.abs(s) < 1e-6) break
      t -= d / s
      if (t < 0 || t > 1) break
    }
    let lo = 0
    let hi = 1
    t = x
    for (let i = 0; i < 30; i++) {
      if (Math.abs(fx(t) - x) < 1e-6) break
      if (fx(t) > x) hi = t
      else lo = t
      t = (lo + hi) / 2
    }
    return fy(t)
  }
}

const easeWindupSpread = cubicBezier(WINDUP_SPREAD_EASE)
const easeWindupRps = cubicBezier(WINDUP_RPS_EASE)
const SPAWN_GAP_RATIO = 0.55
const SPAWN_GAP_MIN = 80
const SPAWN_MARGIN = 24
const SPAWN_SLIDE_Y = 110
const TURN_OVERSHOOT = 140
/* 计算感叹号位置，根据窗口位置而定 */
const BUBBLE_SPACE = 136
const BUBBLE_SPACE_X = 100
const SHAKE_MS = 300 // 对撞后的抖动
const SHAKE_AMP = 16
const SLAM_MS = 280 // 对撞
/* 撞击粒子用多个+号文本生成，数量、飞散范围、落点、大小随机取，在窗口外围一定范围内做抛洒效果 */
const PARTICLE_COUNT = 90
const PARTICLE_GAP = 28 // 生成起点距离窗口边缘的距离
const PARTICLE_BAND = 170
const PARTICLE_DROP = 16
const PARTICLE_DROP_VAR = 20
const PARTICLE_SWAY = 46
const PARTICLE_OP_MIN = 0.35
const PARTICLE_SIZE_MIN = 12
const PARTICLE_SIZE_STEP = 4
const PARTICLE_SIZE_STEPS = 7
const PARTICLE_DUR = 800
const PARTICLE_DUR_VAR = 1400
const PARTICLE_DUR_JITTER = 300 // 距离再做一次二次随机处理
const PARTICLE_DELAY_VAR = 220 // 启动时间错开
const BURST_MS = PARTICLE_DELAY_VAR + PARTICLE_DUR + PARTICLE_DUR_VAR + PARTICLE_DUR_JITTER

const windows = ref([{ key: 0, anchor: null, side: 'left', below: false }])
const duelling = ref(false)
const settling = ref(false)
const bubbleOn = ref(false)
const bubbleLeaving = ref(false)
const burstOn = ref(false)
const particles = ref([])
const impactAt = ref({ x: 0, y: 0 })
const burstStyle = computed(() => ({ left: impactAt.value.x + 'px', top: impactAt.value.y + 'px' }))

function spawnBurst(winRect) {
  const cx = winRect ? winRect.left + winRect.width / 2 : window.innerWidth / 2
  const cy = winRect ? winRect.top + winRect.height / 2 : window.innerHeight / 2
  const bx = (winRect ? winRect.width : 0) / 2 + PARTICLE_GAP
  const by = (winRect ? winRect.height : 0) / 2 + PARTICLE_GAP
  const ox = impactAt.value.x
  const oy = impactAt.value.y
  const list = []
  for (let i = 0; i < PARTICLE_COUNT; i++) {
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
    // 不搞往下落了，观感好奇怪，不会调不搞了
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
          PARTICLE_SIZE_MIN + Math.floor(Math.random() * PARTICLE_SIZE_STEPS) * PARTICLE_SIZE_STEP + 'px',
        animationDuration:
          Math.round(PARTICLE_DUR + far * PARTICLE_DUR_VAR + Math.random() * PARTICLE_DUR_JITTER) + 'ms',
        animationDelay: Math.round(Math.random() * PARTICLE_DELAY_VAR) + 'ms',
      },
    })
  }
  particles.value = list
  burstOn.value = true
  clearTimeout(burstTimer)
  burstTimer = setTimeout(clearBurst, BURST_MS)
}

function clearBurst() {
  burstTimer = 0
  burstOn.value = false
  particles.value = []
}

let nextKey = 1
const refs = new Map()

function setWinRef(key, el) {
  if (el) refs.set(key, el)
  else refs.delete(key)
}

function onWinClose(key) {
  windows.value = windows.value.filter((w) => w.key !== key)
  if (!windows.value.length) emit('close')
}

function bubblePlacement(r, out) {
  const above = r.top
  const belowRoom = window.innerHeight - r.bottom
  const below = above < BUBBLE_SPACE && belowRoom > above
  const outRoom = out === 'left' ? r.left : window.innerWidth - r.right
  const inRoom = out === 'left' ? window.innerWidth - r.right : r.left
  const side = outRoom >= inRoom || outRoom >= BUBBLE_SPACE_X ? out : out === 'left' ? 'right' : 'left'
  return { side, below }
}

function spawnSecond() {
  if (duelling.value || windows.value.length > 1) return
  const first = windows.value[0]
  const el = refs.get(first.key)?.rootEl
  const host = el?.offsetParent
  if (!el || !host) return
  const hostRect = host.getBoundingClientRect()
  const hostTop = hostRect.top + (host.clientTop || 0)
  const hostLeft = hostRect.left + (host.clientLeft || 0)
  const hostW = host.clientWidth
  const w = el.offsetWidth
  const h = el.offsetHeight
  const room = Math.max(0, hostW - 2 * SPAWN_MARGIN - 2 * w)
  const rMax = Math.max(160, window.innerHeight / 2 - h / 2 + TURN_OVERSHOOT)
  const gap = Math.max(SPAWN_GAP_MIN, Math.min(room * SPAWN_GAP_RATIO, rMax * 2 - w))
  const x = Math.max(SPAWN_MARGIN, (hostW - (2 * w + gap)) / 2)
  const bx = Math.min(x + w + gap, Math.max(SPAWN_MARGIN, hostW - w - SPAWN_MARGIN))
  const top = Math.max(0, window.innerHeight / 2 - hostTop - h / 2)
  const slide = Math.max(0, Math.min(SPAWN_SLIDE_Y, window.innerHeight - (hostTop + top + h) - 12))
  const ra = el.getBoundingClientRect()
  const rb = {
    left: hostLeft + bx,
    right: hostLeft + bx + w,
    top: hostTop + top + slide,
    bottom: hostTop + top + slide + h,
  }
  // 默认朝外挂
  const outward = ra.left + ra.width / 2 <= rb.left + w / 2 ? 'left' : 'right'
  const place = (r, out) => bubblePlacement(r, out)
  const pa = place(ra, outward)
  const pb = place(rb, outward === 'left' ? 'right' : 'left')
  const key2 = nextKey++
  windows.value[0].side = pa.side
  windows.value[0].below = pa.below
  windows.value.push({
    key: key2,
    anchor: { left: bx + 'px', top: top + slide + 'px' },
    side: pb.side,
    below: pb.below,
  })
  duelling.value = true
  bubbleLeaving.value = false
  bubbleTimer = setTimeout(() => {
    bubbleOn.value = true
    leadTimer = setTimeout(() => {
      bubbleLeaving.value = true
      fadeTimer = setTimeout(() => {
        bubbleOn.value = false
        bubbleLeaving.value = false
        settling.value = true
        nextTick(() => {
          void el.offsetWidth
          const r = el.getBoundingClientRect()
          const curX = r.left + r.width / 2 - w / 2 - hostLeft
          const curY = r.top + r.height / 2 - h / 2 - hostTop
          writeDuel(el, x - curX, top - curY)
          const elB = refs.get(key2)?.rootEl
          if (elB) writeDuel(elB, 0, -slide)
          settleTimer = setTimeout(startDuel, SETTLE_MS)
        })
      }, BUBBLE_FADE_MS)
    }, BUBBLE_SHOW_MS)
  }, BUBBLE_DELAY_MS)
}

function centerOf(el) {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

function writeDuel(el, x, y) {
  if (!el) return
  el.style.setProperty('--iy-duel-x', x.toFixed(2) + 'px')
  el.style.setProperty('--iy-duel-y', y.toFixed(2) + 'px')
}

const lifted = []

function liftToFront(el, key) {
  const w = el.offsetWidth
  const h = el.offsetHeight
  const host = el.offsetParent
  const hr = host?.getBoundingClientRect()
  const baseX = (hr?.left || 0) + (host?.clientLeft || 0) + el.offsetLeft
  const baseY = (hr?.top || 0) + (host?.clientTop || 0) + el.offsetTop
  const tr = getComputedStyle(el).translate
  const [txs, tys] = tr && tr !== 'none' ? tr.split(' ') : ['0px', '0px']
  const tx = parseFloat(txs) || 0
  const ty = parseFloat(tys) || 0
  const r1 = el.getBoundingClientRect()
  const vx1 = r1.left + r1.width / 2 - w / 2
  const vy1 = r1.top + r1.height / 2 - h / 2
  const entry = { el, host, key, baseX, baseY }
  lifted.push(entry)
  el.style.position = 'fixed'
  el.style.setProperty('--iy-lift-w', w + 'px')
  writeDuel(el, 0, 0)
  el.style.setProperty('--iy-win-fly-y', '0px')
  el.style.left = (baseX + tx).toFixed(2) + 'px'
  el.style.top = (baseY + ty).toFixed(2) + 'px'
  const r2 = el.getBoundingClientRect()
  const ex = r2.left + r2.width / 2 - w / 2 - vx1
  const ey = r2.top + r2.height / 2 - h / 2 - vy1
  entry.baseX -= ex
  entry.baseY -= ey
  el.style.left = (baseX + tx - ex).toFixed(2) + 'px'
  el.style.top = (baseY + ty - ey).toFixed(2) + 'px'
}

function clearLift(entry) {
  const el = entry.el
  el.style.removeProperty('position')
  el.style.removeProperty('left')
  el.style.removeProperty('top')
  el.style.removeProperty('--iy-lift-w')
}

/* 对撞结束就停在这个位置 */
function settleInPlace(entry) {
  const el = entry.el
  const host = entry.host
  if (!el.isConnected || !host) return
  const hr = host.getBoundingClientRect()
  const dx = parseFloat(el.style.getPropertyValue('--iy-duel-x')) || 0
  const dy = parseFloat(el.style.getPropertyValue('--iy-duel-y')) || 0
  const left = entry.baseX + dx - hr.left - (host.clientLeft || 0)
  const top = entry.baseY + dy - hr.top - (host.clientTop || 0)
  const w = el.offsetWidth
  const h = el.offsetHeight
  const r1 = el.getBoundingClientRect()
  const vx1 = r1.left + r1.width / 2 - w / 2
  const vy1 = r1.top + r1.height / 2 - h / 2
  writeDuel(el, 0, 0)
  el.style.setProperty('--iy-win-fly-y', '0px')
  let ax = left
  let ay = top
  el.style.setProperty('--iy-anchor-left', ax.toFixed(2) + 'px')
  el.style.setProperty('--iy-anchor-top', ay.toFixed(2) + 'px')
  el.style.removeProperty('position')
  el.style.removeProperty('left')
  el.style.removeProperty('top')
  const r2 = el.getBoundingClientRect()
  ax -= r2.left + r2.width / 2 - w / 2 - vx1
  ay -= r2.top + r2.height / 2 - h / 2 - vy1
  const anchor = { left: ax.toFixed(2) + 'px', top: ay.toFixed(2) + 'px' }
  el.style.setProperty('--iy-anchor-left', anchor.left)
  el.style.setProperty('--iy-anchor-top', anchor.top)
  // 同步写回响应式锚点：下次重渲染要照这个位置来，否则 Vue 会按 vnode 把变量清掉
  if (windows.value[0]) windows.value[0].anchor = anchor
}

let duelRaf = 0
let shakeRaf = 0
let settleTimer = 0
let bubbleTimer = 0
let leadTimer = 0
let fadeTimer = 0
let impactTimer = 0
let flashTimer = 0
let burstTimer = 0

async function startDuel() {
  const a = windows.value[0]
  const b = windows.value[1]
  const A = refs.get(a.key)
  const B = refs.get(b.key)
  const elA = A?.rootEl
  const elB = B?.rootEl
  if (!elA || !elB) return endDuel()
  A.resetWindowSpin()
  B.resetWindowSpin()
  settling.value = false
  await nextTick()
  if (!elA.isConnected || !elB.isConnected) return endDuel()

  liftToFront(elA, a.key)
  liftToFront(elB, b.key)

  const ca = centerOf(elA)
  const cb = centerOf(elB)
  const flip = ca.x > cb.x
  const left = flip ? { el: elB, c: cb } : { el: elA, c: ca }
  const right = flip ? { el: elA, c: ca } : { el: elB, c: cb }

  const m0 = { x: (ca.x + cb.x) / 2, y: (ca.y + cb.y) / 2 }
  // 轨迹中点最终要落在视口中心
  const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 }

  const r0 = Math.hypot(ca.x - cb.x, ca.y - cb.y) / 2
  const theta0 = Math.atan2(left.c.y - m0.y, left.c.x - m0.x)
  let theta = theta0
  let last = 0
  let t0 = 0
  const tSpin = APPROACH_MS + SPIN_MS // 加速段结束
  const tWind = tSpin + WINDUP_MS // 蓄力段结束
  const tHold = tWind + WINDUP_HOLD_MS // 退到位、停住
  const total = tHold + COLLAPSE_MS

  // 到这儿感叹号已经收完、窗口也滑到位了，直接开转（往后是逐帧写位移，没有过渡）
  t0 = performance.now()
  last = t0
  duelRaf = requestAnimationFrame(step)

  function step(now) {
    const t = now - t0
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    let rps
    if (t < APPROACH_MS) {
      // 起步期用平方
      rps = SPIN_START_RPS * (t / APPROACH_MS) ** 2
    } else if (t < tSpin) {
      rps = SPIN_START_RPS + (SPIN_END_RPS - SPIN_START_RPS) * ((t - APPROACH_MS) / SPIN_MS)
    } else {
      const pt = (t - tSpin - WINDUP_RPS_DELAY_MS) / (WINDUP_MS - WINDUP_RPS_DELAY_MS)
      const p = Math.min(1, Math.max(0, pt))
      rps = SPIN_END_RPS - (SPIN_END_RPS - WINDUP_END_RPS) * easeWindupRps(p)
    }
    theta += rps * Math.PI * 2 * dt

    const mp = Math.min(1, t / APPROACH_MS)
    const eased = mp * mp * (3 - 2 * mp)
    const mx = m0.x + (target.x - m0.x) * eased
    const my = m0.y + (target.y - m0.y) * eased

    let scaleR = 1
    if (t >= tHold) {
      const p = Math.min(1, (t - tHold) / COLLAPSE_MS)
      scaleR = (1 + WINDUP_OUT) * (1 - p ** 2)
    } else if (t >= tWind) {
      scaleR = 1 + WINDUP_OUT
    } else if (t >= tSpin) {
      const p = (t - tSpin) / WINDUP_MS
      scaleR = 1 + WINDUP_OUT * easeWindupSpread(p)
    }
    const rx = r0 * scaleR
    const ry = Math.min(rx, r0)

    const dx = rx * Math.cos(theta)
    const dy = ry * Math.sin(theta)
    writeDuel(left.el, mx + dx - left.c.x, my + dy - left.c.y)
    writeDuel(right.el, mx - dx - right.c.x, my - dy - right.c.y)

    if (t < total) {
      duelRaf = requestAnimationFrame(step)
      return
    }
    duelRaf = 0
    impact()
  }

  function impact() {
    impactAt.value = { x: target.x, y: target.y }
    const keep = windows.value[0]
    const keepRef = refs.get(keep.key)
    const otherRef = refs.get(windows.value[1]?.key)
    const el = keepRef?.rootEl
    slam(el, 1)
    slam(otherRef?.rootEl, -1)
    // 撞击表现试来试去还是闪白最好
    keepRef?.flashHit()
    otherRef?.flashHit()
    // 落点要躲开留下来的这个窗口，所以得把它的矩形传下去
    spawnBurst(el?.getBoundingClientRect())

    // 对撞完的抖动叠在撞击点的位移上逐帧写，translate 属性被 duel 位移占着，不能走 CSS 动画
    const bx = parseFloat(el?.style.getPropertyValue('--iy-duel-x')) || 0
    const by = parseFloat(el?.style.getPropertyValue('--iy-duel-y')) || 0
    const s0 = performance.now()
    const shake = (now) => {
      const p = Math.min(1, (now - s0) / SHAKE_MS)
      const amp = SHAKE_AMP * (1 - p)
      writeDuel(el, bx + (Math.random() * 2 - 1) * amp, by + (Math.random() * 2 - 1) * amp)
      if (p < 1) {
        shakeRaf = requestAnimationFrame(shake)
        return
      }
      shakeRaf = 0
      writeDuel(el, bx, by)
    }
    shakeRaf = requestAnimationFrame(shake)

    // 合体：第二个窗口撤掉、第一个状态重置
    impactTimer = setTimeout(() => {
      windows.value = [keep]
      keepRef?.resetState()
    }, MERGE_MS)
    flashTimer = setTimeout(endDuel, FLASH_MS)
  }
}

/* 对撞震动只做左右摇晃，不形变 */
function slam(el, dir) {
  el?.animate(
    [
      { rotate: '0deg' },
      { rotate: 9 * dir + 'deg', offset: 0.28 },
      { rotate: -6 * dir + 'deg', offset: 0.58 },
      { rotate: 3 * dir + 'deg', offset: 0.8 },
      { rotate: '0deg' },
    ],
    { duration: SLAM_MS, easing: 'ease-out' },
  )
}

function endDuel() {
  cancelAnimationFrame(duelRaf)
  cancelAnimationFrame(shakeRaf)
  clearTimeout(settleTimer)
  clearTimeout(bubbleTimer)
  clearTimeout(leadTimer)
  clearTimeout(fadeTimer)
  clearTimeout(impactTimer)
  clearTimeout(flashTimer)
  duelRaf = 0
  shakeRaf = 0
  const survivor = lifted[0]
  if (survivor) settleInPlace(survivor)
  for (const r of lifted) {
    if (r === survivor) continue
    writeDuel(r.el, 0, 0)
    clearLift(r)
  }
  lifted.length = 0
  duelling.value = false
  settling.value = false
  bubbleOn.value = false
  bubbleLeaving.value = false
  /* 结束后手动设置 focus 状态来置顶 */
  if (survivor) refs.get(survivor.key)?.focusWindow()
}

onBeforeUnmount(() => {
  clearTimeout(burstTimer)
  clearBurst()
  endDuel()
})

defineExpose({ spawnSecond })
</script>

<style scoped>
.iy-duel-burst {
  position: fixed;
  z-index: var(--z-overlay);
  pointer-events: none;
}

.iy-duel-burst > * {
  position: absolute;
  left: 0;
  top: 0;
  translate: -50% -50%;
}

.iy-duel-particle {
  color: #ffffff;
  line-height: 1;
  animation: iy-duel-particle linear both;
}

@keyframes iy-duel-particle {
  0% {
    transform: translate(var(--p-x0), var(--p-y0)) scale(0.5);
    opacity: var(--p-op, 1);
    animation-timing-function: cubic-bezier(0.08, 0.82, 0.24, 1);
  }
  62% {
    opacity: var(--p-op, 1);
  }
  100% {
    transform: translate(calc(var(--p-x) + var(--p-sway)), calc(var(--p-y) + var(--p-drop)));
    opacity: 0;
  }
}
</style>
