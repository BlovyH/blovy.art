<template>
  <Teleport to="body">
    <div ref="layerEl" class="flower-spit" aria-hidden="true" />
  </Teleport>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { backyardEntered } from '@/backyard/backyard.js'
import { registerFlowerSuck } from './flowerSpitBridge.js'

const FLOWER_SRC = '/assets/flower_piece.png'
const GRAVITY = 1100
const BOUNCE = 0.62
const FRICTION = 0.84
const WALL = 4
const BURST_MIN = 12
const BURST_MAX = 44
const MIN_SIZE = 32
const MAX_SIZE = 64
const THROW_SPEED = 700
const LIFT_SPEED = 220
const SPREAD = 0.45
const SPIN_AIR = 320
const ROLL_COUPLE = 1.4
const WALL_SPIN = 0.35
const STACK_OVERLAP = 0.5
const FULL_CELL = 20
// 等效圆半径 / 花边长，按贴图不透明像素占比换算模拟物理效果
const FULL_DISC_RATIO = 0.43
const FULL_RATIO = 0.66
const FULL_MIN_PIECES = 400
const SUCK_MS = 900
const SUCK_TURNS = 1.6
const SUCK_SPIN = 900

const layerEl = ref(null)
let pieces = []
let raf = 0
let last = 0
let frame = null
let notch = null
let vw = 0
let vh = 0
let suck = null

function measure() {
  vw = window.innerWidth
  vh = window.innerHeight
  const f = document.querySelector('.backyard-frame')
  const n = document.querySelector('.backyard-wall-notch')
  frame = f ? f.getBoundingClientRect() : null
  notch = n ? n.getBoundingClientRect() : null
}

function spawn(dir) {
  const mouth = document.querySelector('.emotions-stack')
  if (!mouth || !layerEl.value) return
  const r = mouth.getBoundingClientRect()
  const size = MIN_SIZE + Math.random() * (MAX_SIZE - MIN_SIZE)
  const x = r.left + r.width * 0.5 - size / 2 + (Math.random() - 0.5) * 30
  const y = r.top + r.height * 0.78 - size / 2
  const el = document.createElement('img')
  el.src = FLOWER_SRC
  el.className = 'flower-spit__piece' + (Math.random() < 0.5 ? ' is-dark' : '')
  el.style.width = size + 'px'
  el.style.height = size + 'px'
  el.draggable = false
  layerEl.value.appendChild(el)
  const speed = THROW_SPEED * (0.75 + Math.random() * 0.5)
  pieces.push({
    el, x, y, size,
    vx: (-dir.x + (Math.random() - 0.5) * SPREAD) * speed,
    vy: (-dir.y * 0.55 + (Math.random() - 0.5) * SPREAD) * speed - LIFT_SPEED,
    angle: 0,
    spin: (Math.random() - 0.5) * 2 * SPIN_AIR,
    inside: false,
    landed: false,
    settled: false,
  })
}

// 落点取地面与已经停住的花顶面中最高的一层，让花一层层叠上去
// TODO：目前搞出了吸附的效果，后续试着额外计算重力
function supportY(p, floor) {
  let y = floor
  for (const q of pieces) {
    if (q === p || !q.landed || q.inside !== p.inside) continue
    const dx = (p.x + p.size / 2) - (q.x + q.size / 2)
    if (Math.abs(dx) >= (p.size + q.size) * STACK_OVERLAP) continue
    if (q.y <= p.y) continue
    y = Math.min(y, q.y)
  }
  return y
}

// 满度判定：按落地的花等效圆盖住的网格比例算，重叠不重复计数
function isFull() {
  if (pieces.length < FULL_MIN_PIECES) return false
  const cols = Math.max(1, Math.ceil(vw / FULL_CELL))
  const rows = Math.max(1, Math.ceil(vh / FULL_CELL))
  const grid = new Uint8Array(cols * rows)
  for (const p of pieces) {
    if (!p.landed) continue
    const rad = p.size * FULL_DISC_RATIO
    const cx = p.x + p.size / 2
    const cy = p.y + p.size / 2
    const c0 = Math.max(0, Math.floor((cx - rad) / FULL_CELL))
    const c1 = Math.min(cols - 1, Math.floor((cx + rad) / FULL_CELL))
    const r0 = Math.max(0, Math.floor((cy - rad) / FULL_CELL))
    const r1 = Math.min(rows - 1, Math.floor((cy + rad) / FULL_CELL))
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const dx = (col + 0.5) * FULL_CELL - cx
        const dy = (row + 0.5) * FULL_CELL - cy
        if (dx * dx + dy * dy <= rad * rad) grid[row * cols + col] = 1
      }
    }
  }
  let covered = 0
  for (const v of grid) covered += v
  return covered / grid.length >= FULL_RATIO
}

// 花绕着花圃中心收紧并自转，到中心时消失
function stepSuck(dt) {
  suck.t = Math.min(1, suck.t + (dt * 1000) / SUCK_MS)
  const e = suck.t * suck.t
  for (const p of pieces) {
    const r = p.suckR * (1 - e)
    const a = p.suckA + e * SUCK_TURNS * Math.PI * 2 * p.suckDir
    const cx = suck.cx + Math.cos(a) * r
    const cy = suck.cy + Math.sin(a) * r
    p.el.style.translate = `${cx - p.size / 2}px ${cy - p.size / 2}px`
    p.el.style.rotate = `${(p.angle + p.suckSpin * e).toFixed(1)}deg`
    p.el.style.scale = String(1 - e)
  }
  if (suck.t < 1) return true
  for (const p of pieces) p.el.remove()
  pieces = []
  suck = null
  return false
}

function step(dt) {
  if (suck) return stepSuck(dt)
  let moving = false
  for (const p of pieces) {
    if (p.settled) continue
    moving = true
    p.angle += p.spin * dt

    if (p.landed) {
      p.x += p.vx * dt
      p.vx *= FRICTION
      p.spin = p.vx * ROLL_COUPLE
      const minX = p.inside && frame ? frame.left + WALL : 0
      const maxX = p.inside && frame ? frame.right - WALL - p.size : vw - p.size
      p.x = Math.max(minX, Math.min(maxX, p.x))
      if (Math.abs(p.vx) < 12) { p.vx = 0; p.spin = 0; p.settled = true }
    } else {
      const prevBottom = p.y + p.size
      p.vy += GRAVITY * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      if (p.x < 0) { p.x = 0; p.vx = -p.vx * BOUNCE; p.spin = -p.spin * 0.7 + p.vy * WALL_SPIN }
      if (p.x + p.size > vw) { p.x = vw - p.size; p.vx = -p.vx * BOUNCE; p.spin = -p.spin * 0.7 - p.vy * WALL_SPIN }
      if (p.y < 0) { p.y = 0; p.vy = -p.vy * BOUNCE; p.spin *= 0.8 }

      const cx = p.x + p.size / 2
      const bottom = p.y + p.size
      // backyard 门判断
      if (!p.inside && frame && notch && p.vy > 0 && prevBottom <= frame.top &&
          bottom >= frame.top && cx >= frame.left && cx <= frame.right) {
        if (cx >= notch.left && cx <= notch.right) p.inside = true
        else { p.y = frame.top - p.size; p.vy = -p.vy * BOUNCE; p.spin *= 0.8 }
      }

      if (p.inside && frame) {
        const left = frame.left + WALL
        const right = frame.right - WALL
        const top = frame.top + WALL
        if (p.x < left) { p.x = left; p.vx = -p.vx * BOUNCE; p.spin = -p.spin * 0.7 + p.vy * WALL_SPIN }
        if (p.x + p.size > right) { p.x = right - p.size; p.vx = -p.vx * BOUNCE; p.spin = -p.spin * 0.7 - p.vy * WALL_SPIN }
        // 顶壁只挡向上飞的花，刚从门洞进来时顶边还在墙外
        if (p.vy < 0 && p.y < top) { p.y = top; p.vy = -p.vy * BOUNCE; p.spin *= 0.8 }
      }

      const floor = p.inside && frame ? frame.bottom - WALL : vh
      const restY = supportY(p, floor)
      if (p.vy > 0 && p.y + p.size >= restY) {
        p.y = restY - p.size
        p.vy = 0
        p.landed = true
      }
    }
    p.el.style.translate = `${p.x}px ${p.y}px`
    p.el.style.rotate = `${p.angle.toFixed(1)}deg`
  }
  return moving
}

function tick(now) {
  const dt = Math.min((now - last) / 1000, 0.032)
  last = now
  if (step(dt)) raf = requestAnimationFrame(tick)
  else raf = 0
}

function ensureLoop() {
  if (raf) return
  last = performance.now()
  raf = requestAnimationFrame(tick)
}

// 一次甩动吐一批，方向取甩动的反方向；铺满后返回 true 交给调用方收场
function burst(dir) {
  if (suck) return false
  measure()
  if (isFull()) return true
  const count = BURST_MIN + Math.floor(Math.random() * (BURST_MAX - BURST_MIN + 1))
  for (let i = 0; i < count; i++) spawn(dir)
  ensureLoop()
  return false
}
defineExpose({ burst })

// 没有花返回 false，不接管点击；已在吸入时保持接管
function suckIntoBoard() {
  if (suck) return true
  if (!pieces.length) return false
  const board = document.querySelector('.backyard-board')
  if (!board) return false
  const r = board.getBoundingClientRect()
  const cx = r.left + r.width / 2
  const cy = r.top + r.height / 2
  for (const p of pieces) {
    const dx = p.x + p.size / 2 - cx
    const dy = p.y + p.size / 2 - cy
    p.suckR = Math.hypot(dx, dy)
    p.suckA = Math.atan2(dy, dx)
    p.suckDir = 0.85 + Math.random() * 0.4
    p.suckSpin = SUCK_SPIN * (Math.random() < 0.5 ? -1 : 1) * (0.8 + Math.random() * 0.4)
  }
  suck = { cx, cy, t: 0 }
  ensureLoop()
  return true
}

function clearAll() {
  for (const p of pieces) p.el.remove()
  pieces = []
  suck = null
  if (raf) cancelAnimationFrame(raf)
  raf = 0
}

watch(backyardEntered, (v) => { if (!v) clearAll() })
onMounted(() => {
  registerFlowerSuck(suckIntoBoard)
  window.addEventListener('resize', measure)
})
onBeforeUnmount(() => {
  registerFlowerSuck(null)
  window.removeEventListener('resize', measure)
  clearAll()
})
</script>

<style scoped>
.flower-spit {
  position: fixed;
  inset: 0;
  z-index: var(--z-flower-spit);
  pointer-events: none;
  overflow: hidden;
}

/* 粒子由脚本创建，拿不到 scopeId */
.flower-spit :deep(.flower-spit__piece) {
  position: absolute;
  left: 0;
  top: 0;
  image-rendering: pixelated;
}

.flower-spit :deep(.flower-spit__piece.is-dark) {
  filter: invert(1);
}
</style>
